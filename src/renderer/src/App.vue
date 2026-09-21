<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Versions from './components/Versions.vue'
import CustomTitleBar from './components/CustomTitleBar.vue'
import BiliSearch from './components/BiliSearch.vue'
import { userApi } from './apis/system/index'

const code = ref('')
const winIpc = window as any
const ipcHandle = (): void => winIpc.electronMyAPI.ipcRenderer.send('ping')

const ipcHandleTest = async () => {
  const systemInfo = await userApi.getSystemCode();
  if (systemInfo.code === 200) {
    code.value = 'data:image/gif;base64,' + systemInfo.data.img
  }
  console.log('systemInfo', systemInfo)
}

onMounted(async () => {})
</script>

<template>
  <div>
    <CustomTitleBar />
    <img alt="logo" class="logo" src="./assets/electron.svg" />
    <div class="creator">Powered by electron-vite</div>
    <img :src="code" alt="" />
    <div class="text">
      Build an Electron app with
      <span class="vue">Vue</span>
      and
      <span class="ts">TypeScript</span>
    </div>
    <p class="tip">Please try pressing <code>F12</code> to open the devTool</p>
    <div class="actions">
      <div class="action">
        <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">Documentation</a>
      </div>
      <div class="action">
        <a target="_blank" rel="noreferrer" @click="ipcHandle">Send IPC</a>
      </div>
      <div class="action">
        <a target="_blank" rel="noreferrer" @click="ipcHandleTest">Test Serve</a>
      </div>
    </div>
    <Versions />
    <BiliSearch />
  </div>
</template>
