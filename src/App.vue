<template>
  <n-dialog-provider>
    <div style="height: 100%; background-color: aquamarine; position: relative">
      <n-layout style="height: 100%; width: 100%">
        <!-- 修改头部布局 -->
        <n-layout-header style="height: 64px; padding: 10px" bordered>
          <n-space justify="space-between" align="center">
            <!-- 左侧工具按钮组 -->
            <n-space>
              <n-upload @change="handleFileChange" accept=".pdf" :show-file-list="false">
                <n-button ghost>
                  <template #icon>
                    <n-icon><pdf-icon /></n-icon>
                  </template>
                  打开PDF文件
                </n-button>
              </n-upload>
              <n-button ghost>
                <template #icon>
                  <n-icon><pdf-icon /></n-icon>
                </template>
                新建PDF文件
              </n-button>
              <n-button ghost @click="handleDeletePage" :disabled="!currentPdf">
                <template #icon>
                  <n-icon><delete-icon /></n-icon>
                </template>
                删除当前页面
              </n-button>

              <n-button ghost @click="handleAddImagePage" :disabled="!currentPdf">
                <template #icon>
                  <n-icon><image-icon /></n-icon>
                </template>
                插入图片
              </n-button>

              <n-button ghost :disabled="!currentPdf">
                <template #icon>
                  <n-icon><rotate-icon /></n-icon>
                </template>
                旋转当前页面
              </n-button>

              <n-button ghost @click="handleAddNewPage" :disabled="!currentPdf">
                <template #icon>
                  <n-icon><add-icon /></n-icon>
                </template>
                新建页面
              </n-button>
            </n-space>

            <!-- 右侧保存按钮 -->
            <n-button ghost :disabled="!currentPdf" @click="handleSaveFile">
              <template #icon>
                <n-icon><save-icon /></n-icon>
              </template>
              保存文件
            </n-button>
          </n-space>
        </n-layout-header>
        <n-layout position="absolute" style="top: 64px;" bordered has-sider>
          <n-layout-sider id="pages" content-style="padding: 12px;" :native-scrollbar="false" bordered
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
          <n-layout>
            <n-layout id="content" content-style="padding: 0;" :native-scrollbar="false" bordered>
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

            <!-- 修改页脚布局 -->
            <n-layout-footer position="absolute" style="height: 64px; padding: 24px" bordered>
              <!-- 使用flex布局实现居中 -->
              <div class="footer-container">
                <n-space :size="48" justify="center" align="center">
                  <!-- 连续滚动开关 -->
                  <n-switch v-model:value="continuousScroll">
                    <template #checked>连续滚动</template>
                    <template #unchecked>单页显示</template>
                  </n-switch>

                  <!-- 翻页控制组 -->
                  <n-space v-if="currentPdf" align="center">
                    <n-button ghost :disabled="currentPage <= 0" @click="prevPage">
                      <template #icon>
                        <n-icon><arrow-left-icon /></n-icon>
                      </template>
                    </n-button>
                    <n-input-number v-model:value="displayPage" :min="1" :max="pagesData.length"
                      :style="{ width: '80px' }" @update:value="handlePageChange" />
                    <span>/ {{ pagesData.length }}</span>
                    <n-button ghost :disabled="currentPage >= pagesData.length - 1" @click="nextPage">
                      <template #icon>
                        <n-icon><arrow-right-icon /></n-icon>
                      </template>
                    </n-button>
                  </n-space>

                  <!-- 缩放控制组 -->
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
                </n-space>
              </div>
            </n-layout-footer>
          </n-layout>
        </n-layout>
      </n-layout>
    </div>
    <!-- 新建页面模态框 -->
    <n-modal v-model:show="showCreatePageModal" preset="card" :title="createModalTitle" style="width: 400px">
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
        <n-form-item label="上传图片" path="image">
          <n-upload accept="image/*" :max="1" :default-upload="false" @change="handleImageChange">
            <n-button>选择图片</n-button>
          </n-upload>
        </n-form-item>
        <n-form-item label="图片拟合" path="imageFit">
          <n-radio-group v-model:value="formValue.imageFit">
            <n-radio key="contain" value="contain">保持比例</n-radio>
            <n-radio key="fill" value="fill">填充页面</n-radio>
          </n-radio-group>
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
  </n-dialog-provider>
</template>
<script setup>
import {
  createDiscreteApi,
  useDialog,
  NDialogProvider,
  NLayout,
  NLayoutHeader,
  NLayoutSider,
  NLayoutContent,
  NLayoutFooter,
  NButton, NSpace, NUpload, NEmpty, NButtonGroup, NDropdown, NIcon, NSwitch, NModal, NForm, NFormItem, NRadioGroup, NRadio, NSelect, NInputNumber
} from 'naive-ui'
import { ref, onMounted, nextTick, watch, reactive, computed, onUnmounted } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { ZoomIn as ZoomInIcon, ZoomOut as ZoomOutIcon, Add as AddIcon, Save as SaveIcon, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon, DocumentPdf as PdfIcon, TrashCan as DeleteIcon, Image as ImageIcon, Rotate as RotateIcon } from '@vicons/carbon'
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
  // renderPage(currentPage.value)
}

const zoomOut = () => {
  currentScale.value = Math.max(currentScale.value / 1.2, 0.2)
  // renderPage(currentPage.value)
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

  // renderPage(currentPage.value)
}

const handleFileChange = async ({ file }) => {
  if (!file.file) return
  console.log('pdf file', file.file)

  try {
    // 清理现有状态
    currentPdf.value = null
    currDoc = null
    pagesData.value = []
    currentPage.value = 0

    // 清理缩略图相关状态
    canvasRefs.value = {}
    thumbnailRefs.value = {}

    // 清空缩略图容器
    if (thumbnailsRef.value) {
      thumbnailsRef.value.innerHTML = ''
    }

    // 清空主视图容器
    const pagesContainer = document.querySelector('.pages-container')
    if (pagesContainer) {
      pagesContainer.innerHTML = ''
    }

    // 断开现有观察器
    pageObserver.value?.disconnect()
    thumbnailObserver.value?.disconnect()

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdfDoc = await loadingTask.promise

        // 设置新文档
        currentPdf.value = pdfDoc
        currDoc = pdfDoc
        pagesData.value = Array(pdfDoc.numPages).fill(null)

        // 等待 DOM 更新
        await nextTick()

        // 初始化新的观察器
        initObservers()

        // 重新渲染缩略图
        await renderThumbnails()

        // 渲染主视图
        await renderPages()

        // 选择第一页
        await selectPage(0)

      } catch (error) {
        console.error('加载PDF文件时发生错误:', error)
      }
    }

    reader.onerror = (error) => {
      console.error('读取文件时发生错误:', error)
    }

    reader.readAsArrayBuffer(file.file)

  } catch (error) {
    console.error('处理文件时发生错误:', error)
  }
}


const handleDocUpdate = async (pdfDocBuff, goto = 0) => {
  if (!pdfDocBuff) return

  try {
    // 清理现有状态
    currentPdf.value = null
    currDoc = null
    pagesData.value = []
    currentPage.value = 0

    // 清理缩略图相关状态
    canvasRefs.value = {}
    thumbnailRefs.value = {}

    // 清空缩略图容器
    if (thumbnailsRef.value) {
      thumbnailsRef.value.innerHTML = ''
    }

    // 清空主视图容器
    const pagesContainer = document.querySelector('.pages-container')
    if (pagesContainer) {
      pagesContainer.innerHTML = ''
    }

    // 断开现有观察器
    pageObserver.value?.disconnect()
    thumbnailObserver.value?.disconnect()

    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfDocBuff })
      const pdfDoc = await loadingTask.promise
      // 设置新文档
      currentPdf.value = pdfDoc
      currDoc = pdfDoc
      pagesData.value = Array(pdfDoc.numPages).fill(null)

      // 等待 DOM 更新
      await nextTick()

      // 初始化新的观察器
      initObservers()

      // 重新渲染缩略图
      await renderThumbnails()

      // 渲染主视图
      await renderPages()

      // 选择第一页
      await selectPage(goto)

    } catch (error) {
      console.error('加载PDF文件时发生错误:', error)
    }

  } catch (error) {
    console.error('处理文件时发生错误:', error)
  }
}

// 添加一个渲染锁，防止并发渲染
const renderingLocks = new Map()

// 修改 renderThumbnail 函数
const renderThumbnail = async (pageIndex) => {
  if (!currDoc || !canvasRefs.value[pageIndex]) return
  if (renderingQueue.has(pageIndex)) return
  if (renderingLocks.get(pageIndex)) return

  try {
    renderingQueue.add(pageIndex)
    renderingLocks.set(pageIndex, true)

    const canvas = canvasRefs.value[pageIndex]
    if (!canvas || canvas.dataset.rendered === 'true') {
      renderingQueue.delete(pageIndex)
      renderingLocks.delete(pageIndex)
      return
    }

    const page = await currDoc.getPage(pageIndex + 1)
    const originalViewport = page.getViewport({ scale: 1.0 })

    // 计算缩略图的合适缩放比例
    const maxWidth = 150 // 设置缩略图的最大宽度
    const scale = maxWidth / originalViewport.width

    const viewport = page.getViewport({
      scale: scale,
      rotation: page.rotate || 0
    })

    canvas.width = viewport.width
    canvas.height = viewport.height

    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const renderContext = {
      canvasContext: context,
      viewport,
      background: 'white'
    }

    await page.render(renderContext).promise
    canvas.dataset.rendered = 'true'
  } catch (error) {
    console.error(`渲染缩略图 ${pageIndex + 1} 时发生错误:`, error)
  } finally {
    renderingQueue.delete(pageIndex)
    renderingLocks.delete(pageIndex)
  }
}

// 添加渲染锁Map
const pageRenderLocks = new Map()

// 修改 renderPageContent 函数
const renderPageContent = async (pageIndex, container) => {
  if (!currDoc) return

  // 检查是否已经渲染完成
  if (container.dataset.rendered === 'true') return

  // 检查是否正在渲染
  if (pageRenderLocks.get(pageIndex)) return

  const canvas = container.querySelector('canvas')
  if (!canvas) return

  try {
    // 设置渲染锁
    pageRenderLocks.set(pageIndex, true)

    const page = await currDoc.getPage(pageIndex + 1)
    const viewport = page.getViewport({
      scale: currentScale.value,
      rotation: page.rotate || 0 // 使用页面原始旋转角度，如果没有则默认为0
    })

    // 设置画布尺寸
    canvas.width = viewport.width
    canvas.height = viewport.height

    // 创建新的渲染上下文
    const context = canvas.getContext('2d')
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const renderContext = {
      canvasContext: context,
      viewport,
      background: 'white',
      enableWebGL: true
    }

    // 等待渲染完成
    await page.render(renderContext).promise

    // 标记渲染完成
    container.dataset.rendered = 'true'
  } catch (error) {
    console.error(`渲染页面 ${pageIndex + 1} 时发生错误:`, error)
  } finally {
    // 移除渲染锁
    pageRenderLocks.delete(pageIndex)
  }
}

// 修改 renderPages 函数
const renderPages = async () => {
  if (!currentPdf.value) return

  const container = document.querySelector('.pages-container')
  if (!container) return

  // 清空现有内容和渲染锁
  container.innerHTML = ''
  pageRenderLocks.clear()

  if (continuousScroll.value) {
    // 连续滚动模式：先创建所有占位符
    for (let i = 0; i < currDoc.numPages; i++) {
      const pageContainer = document.createElement('div')
      pageContainer.className = 'page-placeholder'
      pageContainer.dataset.pageIndex = i

      const canvas = document.createElement('canvas')
      canvas.className = 'page-canvas'
      pageContainer.appendChild(canvas)
      container.appendChild(pageContainer)

      // 观察每个页面容器
      pageObserver.value?.observe(pageContainer)
    }

    // 立即渲染可见页面
    const visiblePageIndexes = getVisiblePageIndexes()
    for (const index of visiblePageIndexes) {
      const pageContainer = container.children[index]
      if (pageContainer) {
        await renderPageContent(index, pageContainer)
      }
    }
  } else {
    // 单页模式：只渲染当前页面
    const pageContainer = document.createElement('div')
    pageContainer.className = 'page-placeholder'
    pageContainer.dataset.pageIndex = currentPage.value

    const canvas = document.createElement('canvas')
    canvas.className = 'page-canvas'
    pageContainer.appendChild(canvas)
    container.appendChild(pageContainer)

    // 立即渲染当前页面
    await renderPageContent(currentPage.value, pageContainer)
  }
}

// 添加获取可见页面索引的辅助函数
const getVisiblePageIndexes = () => {
  const container = document.querySelector('.viewer')
  if (!container) return []

  const containerRect = container.getBoundingClientRect()
  const pages = document.querySelectorAll('.page-placeholder')
  const visibleIndexes = []

  pages.forEach((page, index) => {
    const rect = page.getBoundingClientRect()
    if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
      visibleIndexes.push(index)
    }
  })

  return visibleIndexes
}

// 修改 selectPage 函数
const selectPage = async (index) => {
  currentPage.value = index

  // 更新所有缩略图的 active 状态
  const thumbnails = document.querySelectorAll('.thumbnail')
  thumbnails.forEach((thumbnail, i) => {
    if (i === index) {
      thumbnail.classList.add('active')
    } else {
      thumbnail.classList.remove('active')
    }
  })

  if (continuousScroll.value) {
    // 连续滚动模式下，滚动到对应页面
    const container = document.querySelector('.pages-container')
    const targetCanvas = container?.children[index]
    if (targetCanvas) {
      isScrolling = true
      targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setTimeout(() => { isScrolling = false }, 1000)
    }
  } else {
    // 单页模式下，直接重新渲染页面
    await renderPages()
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
    console.log('container', container)
    resizeObserver.observe(container)
  }

  const viewer = document.querySelector('.viewer')
  console.log('viewer', viewer)
  if (viewer) {
    viewer.addEventListener('scroll', () => {
      console.log('Scroll event triggered')
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

        // 更新所有缩略图的 active 状态
        const thumbnails = document.querySelectorAll('.thumbnail')
        thumbnails.forEach((thumbnail, i) => {
          if (i === currentVisibleIndex) {
            thumbnail.classList.add('active')
          } else {
            thumbnail.classList.remove('active')
          }
        })

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
const createModalTitle = ref('新建页面')
const creating = ref(false)
const formRef = ref(null)

const changeModalTitle4BlankPage = (title) => {
  createModalTitle.value = title || '新建页面'
}

const changeModalTitle4ImagePage = (title) => {
  createModalTitle.value = title || '新建图片页面'
}

// 表单数据
const formValue = reactive({
  position: 'after',
  orientation: 'portrait',
  pageSize: 'A4',
  imageFit: 'contain',
  imageFile: null
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

const handleAddImagePage = () => {
  if (!currentPdf) return
  showCreatePageModal.value = true
  changeModalTitle4ImagePage()
}

const handleAddNewPage = () => {
  if (!currentPdf) return
  showCreatePageModal.value = true
  changeModalTitle4BlankPage()
}

// 处理图片选择
const handleImageChange = ({ file }) => {
  if (file.file) {
    formValue.imageFile = file.file
  }
}

// 修改处理创建页面的函数
const handleCreatePage = async () => {
  if (!currDoc) return

  try {
    creating.value = true

    // 获取当前文档的二进制数据
    const existingPdfBytes = await currentPdf.value.getData()

    // 使用 pdf-lib 加载当前文档
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

    // 获取页面尺寸
    let pageSize = PageSizes[formValue.pageSize]
    if (formValue.orientation === 'landscape') {
      pageSize = [pageSize[1], pageSize[0]]
    }

    // 在指定位置插入空白页
    const insertIndex = formValue.position === 'before' ?
      currentPage.value :
      currentPage.value + 1

    const newPage = pdfDoc.insertPage(insertIndex, pageSize)

    // 如果有上传图片，则处理图片
    if (formValue.imageFile) {
      try {
        // 读取图片文件
        const imageData = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(new Uint8Array(reader.result))
          reader.readAsArrayBuffer(formValue.imageFile)
        })

        // 根据文件类型嵌入图片
        let image
        const fileType = formValue.imageFile.type
        if (fileType === 'image/jpeg') {
          image = await pdfDoc.embedJpg(imageData)
        } else if (fileType === 'image/png') {
          image = await pdfDoc.embedPng(imageData)
        } else {
          throw new Error('不支持的图片格式')
        }

        // 计算图片绘制尺寸和位置
        const { width: pageWidth, height: pageHeight } = newPage.getSize()
        let drawWidth = image.width
        let drawHeight = image.height
        let x = 0
        let y = 0

        if (formValue.imageFit === 'contain') {
          // 保持比例
          const scale = Math.min(
            pageWidth / image.width,
            pageHeight / image.height
          )
          drawWidth = image.width * scale
          drawHeight = image.height * scale
          x = (pageWidth - drawWidth) / 2
          y = (pageHeight - drawHeight) / 2
        } else {
          // 填充页面
          drawWidth = pageWidth
          drawHeight = pageHeight
        }

        // 绘制图片
        newPage.drawImage(image, {
          x,
          y,
          width: drawWidth,
          height: drawHeight
        })
      } catch (error) {
        console.error('处理图片时发生错误:', error)
        throw error
      }
    }

    // 保存修改后的文档
    const modifiedPdfBytes = await pdfDoc.save()
    await handleDocUpdate(modifiedPdfBytes, insertIndex)

    // 滚动到插入的新页面
    await selectPage(insertIndex)

    showCreatePageModal.value = false
  } catch (error) {
    console.error('创建图片页面时发生错误:', error)
  } finally {
    creating.value = false
    // 清理图片文件
    formValue.imageFile = null
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


// 添加全局 dialog API
const { dialog } = createDiscreteApi(['dialog'])

// 修改删除页面的处理函数，添加确认对话框
const handleDeletePage = () => {
  if (!currDoc || pagesData.value.length <= 1) return

  if (!dialog) {
    console.error('Dialog provider not found')
    return
  }
  dialog.warning({
    title: '确认删除',
    content: '确定要删除当前页面吗？此操作不可恢复。',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // 获取当前文档的二进制数据
        const existingPdfBytes = await currentPdf.value.getData()

        // 使用 pdf-lib 加载当前文档
        const pdfDoc = await PDFDocument.load(existingPdfBytes)

        // 删除当前页面
        pdfDoc.removePage(currentPage.value)

        // 保存修改后的文档
        const modifiedPdfBytes = await pdfDoc.save()

        // 计算删除后应该跳转到哪一页
        const targetPage = Math.min(currentPage.value, pdfDoc.getPageCount() - 1)

        // 更新文档
        await handleDocUpdate(modifiedPdfBytes, targetPage)

        // 如果删除后还有页面，选择目标页面
        if (pdfDoc.getPageCount() > 0) {
          await selectPage(targetPage)
        }

      } catch (error) {
        console.error('删除页面时发生错误:', error)
        dialog.error({
          title: '错误',
          content: '删除页面时发生错误，请重试',
        })
      }
    }
  })
}

// 处理保存文件
const handleSaveFile = async () => {
  if (!currDoc) return

  try {
    // 获取当前文档的二进制数据
    const existingPdfBytes = await currentPdf.value.getData()

    // 创建 Blob 对象
    const blob = new Blob([existingPdfBytes], { type: 'application/pdf' })

    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // 设置默认文件名
    const now = new Date()
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`
    link.download = `modified_${timestamp}.pdf`

    // 触发下载
    document.body.appendChild(link)
    link.click()

    // 清理
    window.URL.revokeObjectURL(url)
    document.body.removeChild(link)
  } catch (error) {
    console.error('保存文件时发生错误:', error)
  }
}

// 添加页面导航相关状态和方法
const displayPage = computed({
  get: () => currentPage.value + 1,
  set: (val) => {
    handlePageChange(val)
  }
})

// 修改页面导航相关方法
const handlePageChange = (pageNumber) => {
  if (!pageNumber) return
  const newPage = Math.max(1, Math.min(pageNumber, pagesData.value.length)) - 1
  currentPage.value = newPage

  if (continuousScroll.value) {
    // 连续滚动模式下，滚动到对应页面
    const container = document.querySelector('.pages-container')
    const targetCanvas = container?.children[newPage]
    if (targetCanvas) {
      isScrolling = true
      targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => { isScrolling = false }, 1000)
    }
  } else {
    // 单页模式下重新渲染
    renderPages()
  }
}

const prevPage = () => {
  if (currentPage.value > 0) {
    handlePageChange(currentPage.value)
  }
}

const nextPage = () => {
  if (currentPage.value < pagesData.value.length - 1) {
    handlePageChange(currentPage.value + 2)
  }
}

// 修改 watch 以监听页码变化
watch(currentPage, (newPage) => {
  if (!continuousScroll.value) {
    renderPages()
  }
})

// 添加观察器
const pageObserver = ref(null)
const thumbnailObserver = ref(null)

// 初始化观察器
const initObservers = () => {
  // 主视图观察器
  pageObserver.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const pageIndex = parseInt(entry.target.dataset.pageIndex)
        renderPageContent(pageIndex, entry.target)
      }
    })
  }, {
    root: document.querySelector('.viewer'),
    rootMargin: '100px 0px'  // 提前 100px 开始加载
  })

  // 缩略图观察器
  thumbnailObserver.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const pageIndex = parseInt(entry.target.dataset.pageIndex)
        if (!isNaN(pageIndex)) {
          // 确保 entry.target 中有 canvas 元素
          const canvas = entry.target.querySelector('canvas')
          if (canvas) {
            canvasRefs.value[pageIndex] = canvas
            renderThumbnail(pageIndex)
          }
        }
      }
    })
  }, {
    root: document.querySelector('#pages'),
    rootMargin: '50px 0px',
    threshold: 0.1
  })
}

// 修改缩略图渲染函数
const renderThumbnails = async () => {
  if (!currDoc || !thumbnailsRef.value) return

  try {
    const container = thumbnailsRef.value
    container.innerHTML = ''

    // 为每一页创建DOM元素
    for (let i = 0; i < currDoc.numPages; i++) {
      const thumbnail = document.createElement('div')
      thumbnail.className = 'thumbnail'
      // 确保初始状态正确
      if (currentPage.value === i) {
        thumbnail.classList.add('active')
      }
      thumbnail.dataset.pageIndex = i

      const canvas = document.createElement('canvas')
      thumbnail.appendChild(canvas)

      const pageNumber = document.createElement('div')
      pageNumber.className = 'page-number'
      pageNumber.textContent = `第 ${i + 1} 页`
      thumbnail.appendChild(pageNumber)

      container.appendChild(thumbnail)
      canvasRefs.value[i] = canvas
      thumbnailRefs.value[i] = thumbnail

      // 为每个缩略图添加点击事件
      thumbnail.addEventListener('click', () => selectPage(i))

      // 将缩略图添加到观察器
      thumbnailObserver.value?.observe(thumbnail)
    }

    // 立即渲染前几个缩略图
    const initialVisibleCount = 5
    for (let i = 0; i < Math.min(initialVisibleCount, currDoc.numPages); i++) {
      await renderThumbnail(i)
    }
  } catch (error) {
    console.error('创建缩略图时发生错误:', error)
  }
}

// 在组件卸载时清理观察器
onUnmounted(() => {
  pageObserver.value?.disconnect()
  thumbnailObserver.value?.disconnect()
})

// 添加缓存机制
const renderingQueue = new Set()
</script>


<style scoped lang="less">
.thumbnails {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
  padding: 12px;

  :deep(.thumbnail) {
    cursor: pointer;
    border-radius: 4px;
    background-color: white;
    border: 1px solid #e5e5e5;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    width: 100%; // 确保缩略图容器占满宽度
    padding: 4px; // 移动内边距到容器层级
    box-sizing: border-box; // 确保padding不会增加实际宽度

    canvas {
      width: 100%;
      height: auto;
      display: block;
      background-color: white;
      border-radius: 2px;
      // 移除canvas的padding，改为更细致的阴影效果
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.1),
        0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .page-number {
      text-align: center;
      margin-top: 8px;
      font-size: 12px;
      color: #666;
      padding: 4px 0;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.15),
        0 8px 16px rgba(0, 0, 0, 0.1);
    }

    &.active {
      border-color: #18a058;
      box-shadow:
        0 0 0 2px rgba(24, 160, 88, 0.2),
        0 4px 8px rgba(0, 0, 0, 0.1);
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

  :deep(.pages-container) {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    width: fit-content;

    .page-placeholder {
      min-height: 200px;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: white;
      margin-bottom: 20px;
      position: relative; // 添加相对定位
      padding: 20px;
      border-radius: 4px;
      // 添加纸张效果
      border: 1px solid #d9d9d9;
      box-shadow:
        0 1px 4px rgba(0, 0, 0, 0.15),
        0 6px 12px rgba(0, 0, 0, 0.1),
        0 12px 24px rgba(0, 0, 0, 0.05);

      canvas {
        max-width: 100%;
        height: auto;
        background-color: white;
        transition: all 0.3s ease;
      }

      &:not([data-rendered="true"]) {
        &::after {
          content: "加载中...";
          color: #999;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          white-space: nowrap;
          z-index: 1; // 确保显示在最上层
        }
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          0 2px 6px rgba(0, 0, 0, 0.2),
          0 8px 16px rgba(0, 0, 0, 0.15),
          0 16px 32px rgba(0, 0, 0, 0.1);
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

.footer-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.page-placeholder {
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  margin-bottom: 20px;
  position: relative; // 添加相对定位

  &:not([data-rendered="true"]) {
    &::after {
      content: "加载中...";
      color: #999;
      position: absolute; // 使用绝对定位
      top: 50%; // 垂直居中
      left: 50%; // 水平居中
      transform: translate(-50%, -50%); // 完全居中
      font-size: 14px;
      white-space: nowrap; // 防止文本换行
    }
  }
}
</style>
