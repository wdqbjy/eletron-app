import { getMusicInfo, getMusicPlayUrl } from '../apis/bilibili'
import type { RecommendedMusic } from '../apis/bilibili'
import { selectAudioInfo } from '../utils/audio'
import { useDownloadStore } from '../stores/download'
import { useSettingsStore } from '../stores/settings'

/**
 * 音乐下载业务逻辑
 *
 * 流程：
 * 1. music 无 cid → 先 /x/web-interface/view 取整稿 cid；
 * 2. /x/player/playurl 取 DASH 播放信息 → selectAudioInfo 择最优音轨（含 codecs）；
 * 3. 弹出下载管理面板 + addTask（主进程带 Referer/登录态 cookie 拉流写盘，进度实时推送）。
 */
export function useDownload() {
  const downloadStore = useDownloadStore()
  const settings = useSettingsStore()

  async function downloadMusic(music: RecommendedMusic): Promise<void> {
    try {
      let cid = music.cid
      if (!cid) {
        const infoRes = await getMusicInfo(music.bvid)
        if (infoRes?.code !== 0) throw new Error('获取音乐信息失败')
        cid = infoRes.data?.cid
      }
      if (!cid) throw new Error('未获取到分P ID')

      const playUrlRes = await getMusicPlayUrl(music.bvid, cid)
      if (playUrlRes?.code !== 0) {
        throw new Error(playUrlRes?.message || '获取播放地址失败')
      }

      const audioInfo = selectAudioInfo(playUrlRes.data, settings.audioQuality)
      if (!audioInfo?.url) throw new Error('未找到音频地址')

      // 立刻弹出下载管理面板，让用户看到"等待中 → 进度 → 完成"
      downloadStore.setShowDownloadManager(true)
      await downloadStore.addTask({
        audioUrl: audioInfo.url,
        audioCodecs: audioInfo.codecs,
        fileName: `${music.title} - ${music.author}`,
        bvid: music.bvid,
        cid,
        title: music.title,
        author: music.author,
        quality: settings.audioQuality
      })
    } catch (e: any) {
      console.error('[Download] 下载音乐失败:', e)
      // 失败直接 alert 提示
      alert('下载失败：' + (e?.message || '未知错误'))
    }
  }

  return { downloadMusic }
}
