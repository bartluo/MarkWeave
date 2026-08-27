<template>
  <div class="pref-sidebar">
    <h3 class="title">
      {{ t('preferences.title') }}
    </h3>
    <section class="search-wrapper">
      <el-autocomplete
        v-model="state"
        popper-class="pref-autocomplete"
        :fetch-suggestions="querySearch"
        :placeholder="t('preferences.search.placeholder')"
        :trigger-on-focus="false"
        @select="handleSelect"
      >
        <template #suffix>
          <Search
            width="16"
            height="16"
          />
        </template>
        <template #default="{ item }">
          <div class="name">
            {{ item.category }}
          </div>
          <span class="addr">{{ item.preference }}</span>
        </template>
      </el-autocomplete>
    </section>
    <section class="category">
      <div
        v-for="c of getCategory()"
        :key="c.name"
        class="item"
        :class="{ active: c.label === currentCategory }"
        @click="handleCategoryItemClick(c)"
      >
        <component :is="c.icon" />
        <span>{{ c.name }}</span>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { getCategory, getTranslatedSearchContent } from './config'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

interface SearchEntry {
  key: string
  category: string
  categoryEn: string
  preference: string
  preferenceEn: string
  routeCategory: string
  description: string
  enum: unknown[] | undefined
}

interface CategoryItem {
  name: string
  path: string
}

const { t } = useI18n()

const router = useRouter()
const route = useRoute()

const currentCategory = ref<string>('general')
const restaurants = ref<SearchEntry[]>([])
const state = ref<string>('')

watch(
  () => route.name,
  (newRouteName) => {
    if (newRouteName) {
      currentCategory.value = String(newRouteName)
    }
  }
)

const querySearch = (queryString: string, cb: (results: SearchEntry[]) => void): void => {
  const results = queryString
    ? restaurants.value.filter(createFilter(queryString))
    : restaurants.value
  cb(results)
}

const createFilter = (queryString: string): ((restaurant: SearchEntry) => boolean) => {
  const q = queryString.toLowerCase()
  return (restaurant: SearchEntry): boolean => {
    // Support both the current language and English keywords
    const fields = [
      restaurant.preference,
      restaurant.category,
      restaurant.preferenceEn,
      restaurant.categoryEn
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())
    return fields.some((f) => f.indexOf(q) >= 0)
  }
}

const loadAll = (): SearchEntry[] => getTranslatedSearchContent()

const handleSelect = (item: SearchEntry | null | undefined): void => {
  // Use a safe routeCategory to avoid a blank screen caused by invalid categories
  const target =
    item && item.routeCategory ? item.routeCategory : (item?.category || 'general').toLowerCase()
  router.push({ path: `/preference/${target}` }).catch(() => {})
}

const handleCategoryItemClick = (item: CategoryItem): void => {
  if (item.name.toLowerCase() !== currentCategory.value) {
    router.push({
      path: item.path
    })
  }
}

const onIpcCategoryChange = (_event: unknown, category: unknown): void => {
  const categoryName = typeof category === 'string' ? category : ''
  const validRoute =
    categoryName &&
    router.getRoutes().findIndex((r) => r.path.endsWith(`/${categoryName}`)) !== -1
  if (validRoute) {
    router.push({
      path: `/preference/${categoryName}`
    })
  }
}

onMounted(() => {
  restaurants.value = loadAll()
  if (route.name) {
    currentCategory.value = String(route.name)
  }
  window.electron.ipcRenderer.on('settings::change-tab', onIpcCategoryChange)
  // Listen for language changes and refresh the search index
  const languageChanged = (): void => {
    restaurants.value = loadAll()
  }
  window.addEventListener('languageChanged', languageChanged)
  // Remove listener on unmount
  onUnmounted(() => window.removeEventListener('languageChanged', languageChanged))
})

onUnmounted(() => {
  // removeAllListeners takes a single channel argument. The handler ref was
  // passed historically but ignored by the typed bridge; removing only the
  // handler we registered would require holding the unsubscribe callback
  // returned by `.on`, which is not yet plumbed through here.
  window.electron.ipcRenderer.removeAllListeners('settings::change-tab')
})
</script>

<style>
.pref-sidebar {
  -webkit-app-region: drag;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  background: var(--appBarBg);
  border-bottom: 1px solid var(--appBarBorder);
  width: 100%;
  height: auto;
  min-height: 58px;
  padding: calc(var(--titleBarHeight) + 8px) 16px 10px;
  box-sizing: border-box;
  & h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--sideBarColor);
    padding-left: 4px;
  }
}
.search-wrapper {
  -webkit-app-region: no-drag;
  width: 240px;
  flex-shrink: 0;
  margin: 0;
}
.el-autocomplete {
  width: 100%;

  & .el-input__wrapper {
    background: transparent;
  }

  & .el-input__inner {
    border: none;
    background: transparent;
    height: 28px;
    line-height: 28px;
    font-size: 13px;
  }
}
.pref-autocomplete {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  & .el-autocomplete-suggestion__wrap li:hover {
    background: var(--floatHoverColor);
  }
  & .popper__arrow {
    display: none;
  }
  & li {
    line-height: normal;
    padding: 7px;
    opacity: 0.8;

    & .name {
      text-overflow: ellipsis;
      overflow: hidden;
      font-weight: 600;
      color: var(--editorColor80);
    }
    & .addr {
      font-size: 12px;
      color: var(--editorColor);
    }

    & .highlighted .addr {
      color: var(--editorColor);
    }
  }
}
.category {
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  & .item {
    width: auto;
    height: 36px;
    padding: 0 14px;
    font-size: 14px;
    color: var(--sideBarColor);
    border-radius: 8px;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    position: relative;
    user-select: none;
    white-space: nowrap;
    transition: background 0.18s ease-in-out, color 0.18s ease-in-out;
    & > svg {
      width: 18px;
      height: 18px;
      color: var(--sideBarColor);
      margin-right: 8px;
    }
    &.active > svg {
      color: var(--brandA);
    }
    &:hover {
      background: var(--appPanelHover);
    }
    &::before {
      content: '';
      width: 0;
      height: 3px;
      background: var(--brandGrad);
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 0;
      border-radius: 2px 2px 0 0;
      transition: height 0.2s ease-in-out;
    }
    &.active {
      color: var(--sideBarTitleColor);
      background: var(--appPanel);
    }
    &.active::before {
      height: 3px;
    }
  }
}
</style>
