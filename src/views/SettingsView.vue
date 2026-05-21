<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>{{ $t('settings.title') }}</h1>
      <p class="page-desc">{{ $t('settings.desc') }}</p>
    </div>

    <!-- Master Monitor Switch -->
    <div class="monitor-hero glass" :class="{ 'is-active': settings.monitor.running }">
      <div class="hero-left">
        <el-icon class="pulse-icon" v-if="settings.monitor.running"><VideoPlay /></el-icon>
        <el-icon v-else><VideoPause /></el-icon>
        <div class="hero-text">
          <h2>Background Transaction Monitor</h2>
          <p>
            Status: 
            <el-tag :type="settings.monitor.running ? 'success' : 'info'" effect="dark" round size="small">
              {{ settings.monitor.running ? 'ACTIVE' : 'INACTIVE' }}
            </el-tag>
          </p>
        </div>
      </div>
      <div class="hero-right">
        <el-switch 
          v-model="settings.monitor.running" 
          @change="save"
          size="large"
          active-color="#13ce66"
          inactive-color="#ff4949"
        />
      </div>
    </div>

    <div class="settings-grid">
      <!-- General Monitor Settings -->
      <el-card class="panel glass-card">
        <template #header>
          <div class="panel-header">
            <el-icon><Timer /></el-icon> {{ $t('settings.pollerTitle') }}
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item :label="$t('settings.interval')">
            <el-input-number 
              v-model="settings.monitor.intervalSeconds" 
              :min="10" 
              :max="3600" 
              class="full-width"
            />
            <div class="help-text">{{ $t('settings.intervalHelp') }}</div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Telegram -->
      <el-card class="panel glass-card" :class="{ 'card-disabled': !settings.telegram.enabled }">
        <template #header>
          <div class="panel-header space-between">
            <div class="integ-title">
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="TG" class="integ-logo" v-if="settings.telegram.enabled" />
              <el-icon v-else><ChatDotRound /></el-icon>
              <span>Telegram</span>
            </div>
            <el-switch v-model="settings.telegram.enabled" />
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item label="Bot Token">
            <el-input v-model="settings.telegram.botToken" type="password" show-password placeholder="123456789:ABCdefGHI..." :disabled="!settings.telegram.enabled" />
          </el-form-item>
          <el-form-item label="Chat ID">
            <el-input v-model="settings.telegram.chatId" placeholder="-1001234567890" :disabled="!settings.telegram.enabled" />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Discord -->
      <el-card class="panel glass-card" :class="{ 'card-disabled': !settings.discord.enabled }">
        <template #header>
          <div class="panel-header space-between">
            <div class="integ-title">
              <el-icon><Phone /></el-icon>
              <span>Discord</span>
            </div>
            <el-switch v-model="settings.discord.enabled" />
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item label="Webhook URL">
            <el-input v-model="settings.discord.webhookUrl" placeholder="https://discord.com/api/webhooks/..." :disabled="!settings.discord.enabled" />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Custom Webhook -->
      <el-card class="panel glass-card" :class="{ 'card-disabled': !settings.customWebhook.enabled }">
        <template #header>
          <div class="panel-header space-between">
            <div class="integ-title">
              <el-icon><Link /></el-icon>
              <span>Custom Webhook</span>
            </div>
            <el-switch v-model="settings.customWebhook.enabled" />
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item label="Payload URL">
            <el-input v-model="settings.customWebhook.url" placeholder="https://your-api.com/webhook" :disabled="!settings.customWebhook.enabled" />
          </el-form-item>
          <el-form-item label="Webhook Secret (Optional)">
            <el-input v-model="settings.customWebhook.secret" type="password" show-password placeholder="X-Webhook-Secret value" :disabled="!settings.customWebhook.enabled" />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Connection Settings -->
      <el-card class="panel glass-card connection-card">
        <template #header>
          <div class="panel-header">
            <el-icon><Connection /></el-icon>
            <span>Connection Settings</span>
          </div>
        </template>
        <el-form label-position="top">
          <el-form-item label="🌐 Public API URL của CoreBank (dùng cho bot khác)">
            <el-input
              :value="publicApiUrl || 'Đang tải...'"
              readonly
              class="public-url-input"
            >
              <template #append>
                <el-button @click="copyPublicUrl" :disabled="!publicApiUrl" style="cursor:pointer">
                  📋 Copy
                </el-button>
              </template>
            </el-input>
            <div class="help-text" style="color: #67c23a;">
              ✅ Địa chỉ public của CoreBank API — dán vào bot hoặc hệ thống khác để kết nối
            </div>
          </el-form-item>
          <el-form-item label="CoreBank API URL (nội bộ)">
            <el-input
              v-model="settings.connection.coreBankApiUrl"
              placeholder="http://localhost:2002"
              clearable
            />
            <div class="help-text">URL nội bộ của CoreBank backend (mặc định: http://localhost:2002)</div>
          </el-form-item>
          <el-form-item label="Bot Webhook URL">
            <el-input
              v-model="settings.connection.botWebhookUrl"
              placeholder="https://your-bot.com/webhook"
              clearable
            />
            <div class="help-text">Endpoint nhận webhook từ bot thông báo giao dịch</div>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- Actions -->
    <div class="settings-actions glass">
      <el-button @click="testNotification" :loading="testing" :icon="Bell" round size="large">
        {{ $t('settings.testBtn') }}
      </el-button>
      <el-button type="primary" @click="save" :loading="saving" :icon="Select" round size="large">
        {{ $t('settings.saveBtn') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Timer, ChatDotRound, Phone, Link, Bell, Select, Connection } from '@element-plus/icons-vue';
import api from '../api';

interface SettingsData {
  telegram: { enabled: boolean; botToken: string; chatId: string };
  discord: { enabled: boolean; webhookUrl: string };
  customWebhook: { enabled: boolean; url: string; secret: string };
  monitor: { intervalSeconds: number; running: boolean };
  connection: { coreBankApiUrl: string; botWebhookUrl: string };
}

const { t } = useI18n();
const saving = ref(false);
const testing = ref(false);
const publicApiUrl = ref('');

const settings = reactive<SettingsData>({
  telegram: { enabled: false, botToken: '', chatId: '' },
  discord: { enabled: false, webhookUrl: '' },
  customWebhook: { enabled: false, url: '', secret: '' },
  monitor: { intervalSeconds: 60, running: false },
  connection: { coreBankApiUrl: '', botWebhookUrl: '' },
});

const loadSettings = async () => {
  try {
    const [settingsRes, statusRes] = await Promise.all([
      api.get('/settings'),
      api.get('/status'),
    ]);
    if (settingsRes.data?.success && settingsRes.data?.data) {
      Object.assign(settings, settingsRes.data.data);
    }
    if (statusRes.data?.publicApiUrl) {
      publicApiUrl.value = statusRes.data.publicApiUrl;
    }
  } catch (err: any) {
    ElMessage.error(t('settings.loadError') || 'Failed to load settings');
  }
};

const copyPublicUrl = () => {
  navigator.clipboard.writeText(publicApiUrl.value).then(() => {
    ElMessage.success('Đã copy URL!');
  });
};

const save = async () => {
  saving.value = true;
  try {
    const res = await api.post('/settings', settings);
    if (res.data?.success) {
      ElMessage.success(t('settings.saveSuccess'));
    }
  } catch (err: any) {
    ElMessage.error(t('settings.saveError') || 'Failed to save settings');
  } finally {
    saving.value = false;
  }
};



const testNotification = async () => {
  testing.value = true;
  try {
    const res = await api.post('/monitor/test');
    if (res.data?.success) {
      ElMessage.success('Test notification sent!');
    } else {
      ElMessage.error('Test notification failed.');
    }
  } catch (err: any) {
    ElMessage.error('Test notification error.');
  } finally {
    testing.value = false;
  }
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-page {
  padding: 24px 32px;
  width: 100%;
  margin: 0 auto;
  padding-bottom: 120px;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: var(--primary-gradient);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.monitor-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-radius: 16px;
  margin-bottom: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  transition: all 0.3s ease;
}

.monitor-hero.is-active {
  border-color: var(--el-color-success);
  box-shadow: 0 0 20px rgba(19, 206, 102, 0.1);
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-left .el-icon {
  font-size: 40px;
  color: var(--text-muted);
}

.monitor-hero.is-active .hero-left .el-icon {
  color: var(--el-color-success);
}

.pulse-icon {
  animation: pulse 2s infinite;
}

.hero-text h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.hero-text p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
}

.glass-card {
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: transparent;
  transition: all 0.3s ease;
}

.panel-header {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.panel-header.space-between {
  justify-content: space-between;
}

.integ-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.integ-title .el-icon {
  font-size: 18px;
}

.integ-logo {
  width: 18px;
  height: 18px;
}

.card-disabled {
  opacity: 0.6;
  filter: grayscale(0.5);
}

.card-disabled:hover {
  opacity: 0.8;
  filter: grayscale(0.2);
}

.full-width {
  width: 100%;
}

.help-text {
  margin-top: -6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.settings-actions {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width);
  right: 0;
  padding: 20px 40px;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  border-top: 1px solid var(--border-color);
  z-index: 10;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 32px 0 24px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.payos-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  transition: all 0.3s ease;
}

.payos-hero.is-active {
  border-color: #f59e0b;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.12);
}

.payos-icon {
  font-size: 32px;
  color: var(--text-muted);
  transition: color 0.3s;
  display: flex;
  align-items: center;
}

.payos-icon.active {
  color: #f59e0b;
}

.payos-card {
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.2) !important;
  background: rgba(245, 158, 11, 0.03) !important;
}

.connection-card {
  border-color: rgba(59, 130, 246, 0.25) !important;
  background: rgba(59, 130, 246, 0.03) !important;
}

:deep(.public-url-input .el-input__wrapper) {
  background: rgba(103, 194, 58, 0.06) !important;
  border-color: rgba(103, 194, 58, 0.35) !important;
  cursor: default;
}

:deep(.public-url-input .el-input__inner) {
  color: #67c23a !important;
  font-family: monospace;
  font-size: 13px;
}

.flow-card {
  grid-column: 1 / -1;
}

.flow-diagram {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flow-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.flow-step.success-step {
  border-color: rgba(103, 194, 58, 0.3);
  background: rgba(103, 194, 58, 0.04);
}

.step-num {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #000;
}

.flow-step.success-step .step-num {
  background: linear-gradient(135deg, #67c23a, #4ade80);
}

.step-body code {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #f59e0b;
  display: block;
  margin-bottom: 4px;
}

.flow-step.success-step .step-body code {
  color: #67c23a;
}

.step-body p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.flow-arrow {
  text-align: center;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  padding: 0 0 0 22px;
}

.api-snippet {
  margin-top: 4px;
}

.snippet-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.snippet-code {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px 16px;
  margin: 0;
  overflow-x: auto;
}

.snippet-code code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .settings-actions {
    left: 0;
    padding: 16px 24px;
  }
  .monitor-hero,
  .payos-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }
  .hero-right {
    align-self: flex-end;
  }
  .flow-card {
    grid-column: 1;
  }
}
</style>
