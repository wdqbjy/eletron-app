import { defineStore } from 'pinia'
import {
  startDownload,
  getDownloadTasks,
  clearDownloadTasks,
  onDownloadProgress,
  type DownloadTask,
  type DownloadStartParams
} from '../apis/download'

/** 进度推送取消订阅函数（模块级单例，不属于响应式 state） */
let unsubscribeProgress: (() => void) | null = null

/**
 * 下载 store
 * - 任务仅存内存（主进程同样内存态，重启清空）
 * - addTask 先本地插入 waiting 任务（面板立刻出现），再 IPC 发起下载
 * - 主进程经 bili:download-progress 推送进度，registerProgressListener 订阅合并
 */
export const useDownloadStore = defineStore('download', {
  state: () => ({
    tasks: [] as DownloadTask[],
    showDownloadManager: false
  }),
  actions: {
    setShowDownloadManager(show: boolean) {
      this.showDownloadManager = show
    },
    /** 按 id 合并任务（不存在则前插） */
    updateTask(task: DownloadTask) {
      const idx = this.tasks.findIndex((t) => t.id === task.id)
      if (idx > -1) {
        this.tasks[idx] = { ...this.tasks[idx], ...task }
      } else {
        this.tasks.unshift(task)
      }
    },
    /** 从主进程同步任务列表（应用启动时） */
    async loadTasks() {
      try {
        const res = await getDownloadTasks()
        if (res?.code === 0 && Array.isArray(res.data)) {
          this.tasks = res.data
        }
      } catch (e) {
        console.error('[Download] 加载下载任务失败:', e)
      }
    },
    /**
     * 新建下载：生成本地 waiting 任务 → 前插 → IPC 发起。
     * 渲染层生成 id，主进程用同一 id 广播进度，保证两端是同一条任务。
     */
    async addTask(params: Omit<DownloadStartParams, 'id'>) {
      const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const waitingTask: DownloadTask = {
        id,
        title: params.title || params.fileName || '未知文件',
        author: params.author || '',
        bvid: params.bvid || '',
        cid: params.cid ?? '',
        quality: params.quality || 'auto',
        audioCodecs: params.audioCodecs || '',
        fileName: params.fileName || '',
        filePath: '',
        status: 'waiting',
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        createdTime: Date.now(),
        error: ''
      }
      if (!this.tasks.some((t) => t.id === id)) this.tasks.unshift(waitingTask)

      try {
        const res = await startDownload({ ...params, id })
        if (res?.code !== 0) {
          const task = this.tasks.find((t) => t.id === id)
          if (task) {
            task.status = 'error'
            task.error = res?.message || '下载失败'
          }
        }
      } catch (e: any) {
        const task = this.tasks.find((t) => t.id === id)
        if (task) {
          task.status = 'error'
          task.error = e?.message || '下载失败'
        }
      }
    },
    /** 清空记录（已下载文件保留） */
    async clearTasks() {
      try {
        await clearDownloadTasks()
        this.tasks = []
      } catch (e) {
        console.error('[Download] 清空任务失败:', e)
      }
    },
    /** 订阅主进程进度推送（App.vue onMounted 注册） */
    registerProgressListener() {
      if (unsubscribeProgress) return
      unsubscribeProgress = onDownloadProgress((task) => {
        this.updateTask(task)
      })
    },
    unregisterProgressListener() {
      if (unsubscribeProgress) {
        unsubscribeProgress()
        unsubscribeProgress = null
      }
    }
  }
})
