<template>
  <div style="height: 100%; background-color: aquamarine; position: relative">
    <n-layout style="height: 100%; width: 100%">
      <n-layout-header style="height: 64px; padding: 10px" bordered>
        <n-space>
          <n-upload @change="handleFileChange" accept=".pdf" :show-file-list="false">
            <n-button ghost>打开PDF文件</n-button>
          </n-upload>
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
  NButton, NSpace, NUpload, NEmpty
} from 'naive-ui'
import { ref, onMounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js';
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';

console.log('pdfjsLib', pdfjsLib.version)
// 设置 PDF.js worker
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.com/libraries/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
// pdfjsLib.GlobalWorkerOptions.workerSrc = `pdfjs-dist/pdf.worker.mjs`
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();
/* pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-worker',
  import.meta.url
).toString(); */

const currentPdf = ref(null)
const pagesData = ref([])
const currentPage = ref(0)
const canvasRefs = ref({})
const mainCanvas = ref(null)
let currDoc = null

// 加载文件
const handleFileChange = async ({ file }) => {
  // naiveUI的upload组件返回的是一个包含file的对象
  // file.file 是实际的File对象
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
      // 等待下一个 tick，确保 canvas 引用可用
      await nextTick()
      // 渲染所有缩略图
      for (let i = 0; i < pdfDoc.numPages; i++) {
        await renderThumbnail(i)
      }

      // 渲染当前页
      renderPage(currentPage.value)
    } catch (error) {
      console.error('加载PDF文件时发生错误:', error)
    }
  }

  reader.onerror = (error) => {
    console.error('读取文件时发生错误:', error)
  }

  // 直接使用file而不是file.file
  reader.readAsArrayBuffer(file.file)
}

const renderThumbnail = async (pageIndex) => {
  console.log('renderThumbnail', pageIndex,)
  console.log('currentPdf', currentPdf.value,)
  console.log('canvasRefs', canvasRefs.value)
  console.log(`canvasRefs[${pageIndex}]`, canvasRefs.value[pageIndex])
  // 确保 currentPdf 和 canvasRefs 有效
  if (!currentPdf.value || !canvasRefs.value[pageIndex]) {
    console.error('currentPdf 或 canvasRefs 无效');
    return;
  }
  console.log('-----getpage:', pageIndex + 1)
  // const page = await currentPdf.value.getPage(pageIndex + 1)
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

  // const page = await currentPdf.value.getPage(pageIndex + 1)
  const page = await currDoc.getPage(pageIndex + 1)
  const canvas = mainCanvas.value
  const viewport = page.getViewport({ scale: 1.5 })

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

  canvas {
    max-width: 100%;
    height: auto;
  }
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
