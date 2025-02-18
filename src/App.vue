<template>
  <div style="height: 100%; background-color: aquamarine; position: relative">
    <n-layout style="height: 100%; width: 100%">
      <n-layout-header style="height: 64px; padding: 10px" bordered>
        <n-space>
          <n-upload @change="handleFileChange" accept=".pdf" :show-file-list="false">
            <n-button ghost>打开PDF文件</n-button>
          </n-upload>
          <n-button-group v-if="currentPdf">
            <n-button ghost @click="zoomIn">
              <template #icon>
                <n-icon><zoom-in-icon /></n-icon>
              </template>
            </n-button>
            <n-button ghost @click="zoomOut">
              <template #icon>
                <n-icon><zoom-out-icon /></n-icon>
              </template>
            </n-button>
            <n-dropdown :options="scaleOptions" @select="handleScaleSelect">
              <n-button ghost>{{ Math.round(currentScale * 100) }}%</n-button>
            </n-dropdown>
          </n-button-group>
          <n-button ghost :disabled="!currentPdf">上方插入空白页</n-button>
          <n-button ghost :disabled="!currentPdf">下方插入空白页</n-button>
          <n-button ghost :disabled="!currentPdf">删除当前页面</n-button>
          <n-button ghost :disabled="!currentPdf">插入图片</n-button>
          <n-button ghost :disabled="!currentPdf">旋转当前页面</n-button>
        </n-space>
      </n-layout-header>
      <n-layout position="absolute" style="top: 64px; bottom: 64px;" bordered has-sider>
        <n-layout-sider id="pages" content-style="padding: 24px;" :native-scrollbar="false" bordered
          collapse-mode="width" :collapsed-width="120" :width="200">
          <div v-if="pagesData.length" class="thumbnails">
            <div v-for="(page, index) in pagesData" :key="index" class="thumbnail"
              :class="{ active: currentPage === index }" @click="selectPage(index)">
              <canvas :ref="el => { if (el) canvasRefs[index] = el }"></canvas>
              <div class="page-number">第 {{ index + 1 }} 页</div>
            </div>
          </div>
        </n-layout-sider>
        <n-layout id="content" content-style="padding: 24px;" :native-scrollbar="false" bordered>
          <div v-if="currentPdf" class="viewer">
            <canvas ref="mainCanvas"></canvas>
          </div>
          <div v-else class="empty-state">
            <n-empty description="请选择PDF文件">
              <template #extra>
                <n-upload @change="handleFileChange" accept=".pdf" :show-file-list="false">
                  <n-button>选择文件</n-button>
                </n-upload>
              </template>
            </n-empty>
          </div>
        </n-layout>
      </n-layout>
      <n-layout-footer position="absolute" style="height: 64px; padding: 24px" bordered>
        <span v-if="currentPdf">当前页面：{{ currentPage + 1 }} / {{ pagesData.length }}</span>
      </n-layout-footer>
    </n-layout>
  </div>
</template>
<script setup>
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NLayoutFooter,
  NButton, NSpace, NUpload, NEmpty, NButtonGroup, NDropdown, NIcon
} from 'naive-ui'
import { ref, onMounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon } from '@vicons/carbon'

console.log('pdfjsLib', pdfjsLib.version)

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const currentPdf = ref(null)
const pagesData = ref([])
const currentPage = ref(0)
const canvasRefs = ref({})
const mainCanvas = ref(null)
let currDoc = null

const currentScale = ref(1.0)
const containerWidth = ref(0)
const containerHeight = ref(0)

const scaleOptions = [
  { label: '自适应页面', key: 'fit-page' },
  { label: '自适应宽度', key: 'fit-width' },
  { label: '实际大小', key: '100' },
  { label: '50%', key: '50' },
  { label: '75%', key: '75' },
  { label: '100%', key: '100' },
  { label: '125%', key: '125' },
  { label: '150%', key: '150' },
  { label: '200%', key: '200' },
]

const zoomIn = () => {
  currentScale.value = Math.min(currentScale.value * 1.2, 5)
  renderPage(currentPage.value)
}

const zoomOut = () => {
  currentScale.value = Math.max(currentScale.value / 1.2, 0.2)
  renderPage(currentPage.value)
}

const handleScaleSelect = async (key) => {
  if (!currDoc) return

  const page = await currDoc.getPage(currentPage.value + 1)
  const viewport = page.getViewport({ scale: 1 })
  const container = document.querySelector('.viewer')
  
  switch (key) {
    case 'fit-page':
      const scaleHeight = (container.clientHeight - 40) / viewport.height
      const scaleWidth = (container.clientWidth - 40) / viewport.width
      currentScale.value = Math.min(scaleHeight, scaleWidth)
      break
    case 'fit-width':
      currentScale.value = (container.clientWidth - 40) / viewport.width
      break
    default:
      currentScale.value = parseInt(key) / 100
  }
  
  renderPage(currentPage.value)
}

const handleFileChange = async ({ file }) => {
  if (!file.file) return
  console.log('pdf file', file.file)

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result
      console.log('arrayBuffer', arrayBuffer)
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      console.log('pdfDoc', pdfDoc)
      const page = await pdfDoc.getPage(1);
      console.log('page1', page)

      currentPdf.value = pdfDoc
      currDoc = pdfDoc
      pagesData.value = Array(pdfDoc.numPages).fill(null)
      currentPage.value = 0
      console.log('currentPdf：', pdfDoc, pdfDoc.numPages)
      await nextTick()
      for (let i = 0; i < pdfDoc.numPages; i++) {
        await renderThumbnail(i)
      }

      renderPage(currentPage.value)
    } catch (error) {
      console.error('加载PDF文件时发生错误:', error)
    }
  }

  reader.onerror = (error) => {
    console.error('读取文件时发生错误:', error)
  }

  reader.readAsArrayBuffer(file.file)
}

const renderThumbnail = async (pageIndex) => {
  console.log('renderThumbnail', pageIndex,)
  console.log('currentPdf', currentPdf.value,)
  console.log('canvasRefs', canvasRefs.value)
  console.log(`canvasRefs[${pageIndex}]`, canvasRefs.value[pageIndex])
  if (!currentPdf.value || !canvasRefs.value[pageIndex]) {
    console.error('currentPdf 或 canvasRefs 无效');
    return;
  }
  console.log('-----getpage:', pageIndex + 1)
  const page = await currDoc.getPage(pageIndex + 1)
  console.log('page', page)
  const canvas = canvasRefs.value[pageIndex]
  const viewport = page.getViewport({ scale: 0.2 })
  console.log('canvas', canvas, viewport)
  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport
  }).promise
}

const renderPage = async (pageIndex) => {
  if (!currentPdf.value || !mainCanvas.value) return

  const page = await currDoc.getPage(pageIndex + 1)
  const canvas = mainCanvas.value
  const viewport = page.getViewport({ scale: currentScale.value })

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport
  }).promise
}

const selectPage = (index) => {
  currentPage.value = index
  renderPage(index)
}

onMounted(() => {
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      containerWidth.value = entry.contentRect.width
      containerHeight.value = entry.contentRect.height
    }
  })

  const container = document.querySelector('.viewer')
  if (container) {
    resizeObserver.observe(container)
  }
})
</script>


<style scoped lang="less">
.thumbnails {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .thumbnail {
    cursor: pointer;
    padding: 5px;
    border: 2px solid transparent;

    &.active {
      border-color: #18a058;
    }

    canvas {
      width: 100%;
      height: auto;
    }

    .page-number {
      text-align: center;
      margin-top: 5px;
      font-size: 12px;
    }
  }
}

.viewer {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  height: 100%;
  overflow: auto;
  padding: 20px;

  canvas {
    max-width: 100%;
    height: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
