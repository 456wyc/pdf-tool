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
          <n-switch v-model:value="continuousScroll">
            <template #checked>连续滚动</template>
            <template #unchecked>单页显示</template>
          </n-switch>
          <n-button ghost @click="showCreatePageModal = true" :disabled="!currentPdf">
            <template #icon>
              <n-icon><add-icon /></n-icon>
            </template>
            新建空白页
          </n-button>
        </n-space>
      </n-layout-header>
      <n-layout position="absolute" style="top: 64px; bottom: 64px;" bordered has-sider>
        <n-layout-sider id="pages" content-style="padding: 24px;" :native-scrollbar="false" bordered
          collapse-mode="width" :collapsed-width="120" :width="200" @scroll="handleThumbnailScroll">
          <div v-if="pagesData.length" class="thumbnails" ref="thumbnailsRef">
            <div v-for="(page, index) in pagesData" :key="index" class="thumbnail"
              :class="{ active: currentPage === index }" @click="selectPage(index)"
              :ref="el => { if (el) thumbnailRefs[index] = el }">
              <canvas :ref="el => { if (el) canvasRefs[index] = el }"></canvas>
              <div class="page-number">第 {{ index + 1 }} 页</div>
            </div>
          </div>
        </n-layout-sider>
        <n-layout id="content" content-style="padding: 24px;" :native-scrollbar="false" bordered>
          <div v-if="currentPdf" class="viewer">
            <div class="pages-container"></div>
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
  <n-modal v-model:show="showCreatePageModal" preset="card" title="新建空白页面" style="width: 400px">
    <n-form ref="formRef" :model="formValue" :rules="rules">
      <n-form-item label="插入位置" path="position">
        <n-radio-group v-model:value="formValue.position">
          <n-radio key="before" value="before">在当前页前</n-radio>
          <n-radio key="after" value="after">在当前页后</n-radio>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="页面方向" path="orientation">
        <n-radio-group v-model:value="formValue.orientation">
          <n-radio key="portrait" value="portrait">纵向</n-radio>
          <n-radio key="landscape" value="landscape">横向</n-radio>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="页面大小" path="pageSize">
        <n-select v-model:value="formValue.pageSize" :options="pageSizeOptions" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showCreatePageModal = false">取消</n-button>
        <n-button type="primary" @click="handleCreatePage" :loading="creating">
          确定
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>
<script setup>
import {
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NLayoutFooter,
  NButton, NSpace, NUpload, NEmpty, NButtonGroup, NDropdown, NIcon, NSwitch, NModal, NForm, NFormItem, NRadioGroup, NRadio, NSelect
} from 'naive-ui'
import { ref, onMounted, nextTick, watch, reactive } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, Add as AddIcon } from '@vicons/carbon'
import { PDFDocument, PageSizes } from 'pdf-lib'

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

const continuousScroll = ref(true)
const pagesCanvasRefs = ref({})

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
      
      // 等待 DOM 更新
      await nextTick()
      
      // 先渲染所有缩略图
      for (let i = 0; i < pdfDoc.numPages; i++) {
        await renderThumbnail(i)
      }

      // 渲染主视图（根据当前的连续滚动模式）
      await renderPages()  // 修改这里，使用 renderPages 替代 renderPage
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

const renderPages = async () => {
  if (!currentPdf.value) return

  const container = document.querySelector('.pages-container')
  if (!container) return

  // 清空现有内容
  container.innerHTML = ''

  if (continuousScroll.value) {
    // 连续滚动模式：渲染所有页面
    for (let i = 0; i < currDoc.numPages; i++) {
      const canvas = document.createElement('canvas')
      canvas.className = 'page-canvas'
      container.appendChild(canvas)
      pagesCanvasRefs.value[i] = canvas

      const page = await currDoc.getPage(i + 1)
      const viewport = page.getViewport({ scale: currentScale.value })

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise
    }

    // 在渲染完成后滚动到当前页面
    nextTick(() => {
      const targetCanvas = container.children[currentPage.value]
      if (targetCanvas) {
        isScrolling = true
        targetCanvas.scrollIntoView({ behavior: 'instant', block: 'start' })
        setTimeout(() => { isScrolling = false }, 100)
      }
    })
  } else {
    // 单页模式：只渲染当前页
    const canvas = document.createElement('canvas')
    canvas.className = 'page-canvas'
    container.appendChild(canvas)
    mainCanvas.value = canvas // 添加这行，更新 mainCanvas 引用

    const page = await currDoc.getPage(currentPage.value + 1)
    const viewport = page.getViewport({ scale: currentScale.value })

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport
    }).promise
  }
}

const selectPage = async (index) => {
  currentPage.value = index

  if (!continuousScroll.value) {
    // 单页模式下重新渲染页面
    renderPages()
  }
}

watch(continuousScroll, () => {
  renderPages()
})

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

  const viewer = document.querySelector('.viewer')
  if (viewer) {
    viewer.addEventListener('scroll', () => {
      if (!continuousScroll.value || isScrolling) return

      const container = viewer.getBoundingClientRect()
      const canvases = document.querySelectorAll('.pages-container .page-canvas')
      let currentVisibleIndex = -1

      // 使用 Array.from 来处理 NodeList
      Array.from(canvases).forEach((canvas, index) => {
        const rect = canvas.getBoundingClientRect()
        // 使用更精确的判断方法
        const elementMidpoint = rect.top + rect.height / 2
        const containerMidpoint = container.top + container.height / 2

        // 如果页面的中点最接近容器的中点，则认为该页面是当前可见页面
        if (currentVisibleIndex === -1 ||
          Math.abs(elementMidpoint - containerMidpoint) <
          Math.abs(canvases[currentVisibleIndex].getBoundingClientRect().top +
            canvases[currentVisibleIndex].getBoundingClientRect().height / 2 -
            containerMidpoint)) {
          currentVisibleIndex = index
        }
      })

      if (currentVisibleIndex !== -1 && currentVisibleIndex !== currentPage.value) {
        // 更新当前页码
        currentPage.value = currentVisibleIndex

        // 滚动缩略图到对应位置
        const thumbnail = thumbnailRefs.value[currentVisibleIndex]
        if (thumbnail) {
          isScrolling = true
          thumbnail.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => { isScrolling = false }, 1000)
        }
      }
    }, { passive: true }) // 添加 passive 选项提高性能
  }
})

// 添加对缩放的监听
watch(currentScale, () => {
  renderPages()
})

// 新增状态
const showCreatePageModal = ref(false)
const creating = ref(false)
const formRef = ref(null)

// 表单数据
const formValue = reactive({
  position: 'after',
  orientation: 'portrait',
  pageSize: 'A4'
})

// 页面大小选项
const pageSizeOptions = [
  { label: 'A3', value: 'A3' },
  { label: 'A4', value: 'A4' },
  { label: 'A5', value: 'A5' },
  { label: 'Letter', value: 'Letter' },
  { label: 'Legal', value: 'Legal' }
]

// 表单验证规则
const rules = {
  position: {
    required: true,
    message: '请选择插入位置'
  },
  orientation: {
    required: true,
    message: '请选择页面方向'
  },
  pageSize: {
    required: true,
    message: '请选择页面大小'
  }
}

// 处理创建空白页面
const handleCreatePage = async () => {
  if (!currDoc) return

  try {
    creating.value = true

    // 先获取当前文档的二进制数据
    const existingPdfBytes = await currentPdf.value.getData()

    // 使用 pdf-lib 加载当前文档
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

    // 获取页面尺寸
    let pageSize = PageSizes[formValue.pageSize]
    if (formValue.orientation === 'landscape') {
      pageSize = [pageSize[1], pageSize[0]] // 交换宽高实现横向
    }

    // 在指定位置插入空白页
    const insertIndex = formValue.position === 'before' ?
      currentPage.value :
      currentPage.value + 1

    pdfDoc.insertPage(insertIndex, pageSize)

    // 保存修改后的文档
    const modifiedPdfBytes = await pdfDoc.save()

    // 重新加载修改后的文档
    const loadingTask = pdfjsLib.getDocument({ data: modifiedPdfBytes })
    const newPdfDoc = await loadingTask.promise

    // 更新当前文档
    currentPdf.value = newPdfDoc
    currDoc = newPdfDoc
    pagesData.value = Array(newPdfDoc.numPages).fill(null)

    // 重新渲染所有页面
    await nextTick()
    for (let i = 0; i < newPdfDoc.numPages; i++) {
      await renderThumbnail(i)
    }

    // 如果是连续滚动模式，重新渲染主视图
    if (continuousScroll.value) {
      renderPages()
    } else {
      renderPage(currentPage.value)
    }

    showCreatePageModal.value = false
  } catch (error) {
    console.error('创建空白页面时发生错误:', error)
  } finally {
    creating.value = false
  }
}

// 添加缩略图引用
const thumbnailsRef = ref(null)
const thumbnailRefs = ref({})
let isScrolling = false

// 修改 handleThumbnailScroll 函数
const handleThumbnailScroll = (e) => {
  // 移除整个函数内容，因为我们不需要缩略图滚动时影响大图
  // 如果将来需要记录当前可见缩略图，可以保留计算逻辑但不触发页面切换
}
</script>


<style scoped lang="less">
.thumbnails {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;

  .thumbnail {
    cursor: pointer;
    padding: 12px;
    border-radius: 4px;
    background-color: white;
    border: 1px solid #e5e5e5;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.12),
        0 4px 6px rgba(0, 0, 0, 0.07),
        0 8px 16px rgba(0, 0, 0, 0.05);
    }

    &.active {
      border-color: #18a058;
      box-shadow:
        0 0 0 2px rgba(24, 160, 88, 0.2),
        0 2px 4px rgba(0, 0, 0, 0.12),
        0 4px 8px rgba(0, 0, 0, 0.08);
    }

    canvas {
      width: 100%;
      height: auto;
      border-radius: 2px;
      background-color: white;
    }

    .page-number {
      text-align: center;
      margin-top: 8px;
      font-size: 12px;
      color: #666;
      font-weight: 500;
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
  background-color: #f5f5f5;

  .pages-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    width: fit-content;

    canvas {
      max-width: 100%;
      height: auto;
      padding: 20px;
      background-color: white;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.1),
        0 4px 6px rgba(0, 0, 0, 0.05),
        0 10px 20px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          0 2px 4px rgba(0, 0, 0, 0.12),
          0 6px 8px rgba(0, 0, 0, 0.07),
          0 12px 24px rgba(0, 0, 0, 0.05);
      }
    }
  }
}

.empty-state {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
