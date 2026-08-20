<template>
  <div class="recent-files-projects">
    <div class="centered-group">
      <div class="brand-mark">
        <img
          class="welcome-logo"
          :src="MarkWeaveLogo"
          alt="MarkWeave"
        >
      </div>

      <h2 class="welcome-title">
        MarkWeave
      </h2>
      <p class="welcome-subtitle">
        {{ t('recent.tagline') }}
      </p>

      <div class="welcome-actions">
        <el-button
          class="welcome-btn primary"
          type="primary"
          @click="newFile"
        >
          <el-icon class="btn-icon">
            <DocumentAdd />
          </el-icon>
          {{ t('recent.newFile') }}
        </el-button>
        <el-button
          class="welcome-btn"
          @click="openFile"
        >
          <el-icon class="btn-icon">
            <FolderOpened />
          </el-icon>
          {{ t('recent.openFile') }}
        </el-button>
        <el-button
          class="welcome-btn"
          @click="openFolder"
        >
          <el-icon class="btn-icon">
            <Folder />
          </el-icon>
          {{ t('recent.openFolder') }}
        </el-button>
      </div>

      <p class="welcome-hint">
        {{ t('recent.hint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '@/store/editor'
import { DocumentAdd, FolderOpened, Folder } from '@element-plus/icons-vue'
import { t } from '../../i18n'
import MarkWeaveLogo from '../../assets/images/logo.png'

const editorStore = useEditorStore()

const newFile = () => {
  editorStore.NEW_UNTITLED_TAB({})
}

const openFile = () => {
  window.electron.ipcRenderer.send('mt::cmd-open-file')
}

const openFolder = () => {
  window.electron.ipcRenderer.send('mt::cmd-open-folder')
}
</script>

<style scoped>
.recent-files-projects {
  background: var(--editorBgColor);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  & .centered-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 460px;
    padding: 0 40px;
    text-align: center;

    & .brand-mark {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;

      & .welcome-logo {
        width: 76px;
        height: 76px;
        border-radius: 22px;
        box-shadow:
          0 2px 8px rgba(0, 0, 0, 0.06),
          0 16px 40px rgba(91, 110, 225, 0.18);
      }
    }

    & .welcome-title {
      margin: 0 0 10px;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: var(--editorColor80);
    }

    & .welcome-subtitle {
      margin: 0 0 40px;
      font-size: 15px;
      line-height: 1.6;
      color: var(--editorColor50);
    }

    & .welcome-actions {
      display: flex;
      flex-direction: row;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;

      & .welcome-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 40px;
        padding: 0 22px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          background-color 0.18s ease;

        & .btn-icon {
          font-size: 16px;
        }

        &:hover {
          transform: translateY(-1px);
        }
      }

      & .welcome-btn.primary {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 6px 18px rgba(91, 110, 225, 0.28);

        &:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 10px 26px rgba(91, 110, 225, 0.34);
        }
      }

      & .welcome-btn:not(.primary) {
        background: var(--buttonPrimaryBgColor);
        border: 1px solid transparent;
        color: var(--buttonPrimaryFontColor);

        &:hover {
          background: var(--buttonPrimaryBgColorHover);
          color: var(--buttonPrimaryFontColorHover);
          border-color: transparent;
        }
      }
    }

    & .welcome-hint {
      margin: 32px 0 0;
      font-size: 12px;
      color: var(--editorColor30);
      letter-spacing: 0.2px;
    }
  }
}
</style>
