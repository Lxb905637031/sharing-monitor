import { onBFCacheRestore } from './bfcache'

/**
 * 记录页面首次进入隐藏状态的时间戳（初始值-1表示未初始化）
 * - 非-1值：页面首次隐藏的时间戳（毫秒）
 * - 0：页面初始化时已处于隐藏状态
 * - Infinity：页面初始化时处于可见状态
 */
let firstHiddenTime = -1

/**
 * 初始化页面首次隐藏时间的初始值
 * 核心逻辑：判断页面初始化时是否处于「非预渲染的隐藏状态」
 * @returns {number} 初始化的首次隐藏时间：
 *          - 0：页面初始为hidden且非预渲染状态
 *          - Infinity：页面初始为visible 或 处于预渲染状态
 */

const initHiddenTime = () => {
    return document.visibilityState === 'hidden' && !(document as { prerendering?: boolean }).prerendering ? 0 : Infinity
}

/**
 * 页面可见性/预渲染状态变更的回调函数
 * @param {Event} event - 事件对象（visibilitychange/prerenderingchange）
 */
const onVisibilityUpdate = (event: Event) => {
    if (document.visibilityState === 'hidden' && firstHiddenTime > -1) {
        firstHiddenTime = event.type === 'visibilitychange' ? event.timeStamp : 0

        removeChangeListeners()
    }
}

/**
 * 添加页面可见性/预渲染状态变更的监听
 * - visibilitychange：页面可见状态（visible/hidden）变更时触发
 * - prerenderingchange：页面预渲染状态变更时触发（实验性事件）
 */
const addChangeListeners = () => {
    addEventListener('visibilitychange', onVisibilityUpdate)

    addEventListener('prerenderingchange', onVisibilityUpdate)
}

/**
 * 移除页面可见性/预渲染状态变更的监听（避免内存泄漏）
 */
const removeChangeListeners = () => {
    removeEventListener('visibilitychange', onVisibilityUpdate)

    removeEventListener('prerenderingchange', onVisibilityUpdate)
}

/**
 * 获取页面可见性监控器（单例逻辑：仅初始化一次）
 * @returns {Object} 包含firstHiddenTime的只读访问器对象
 *          - firstHiddenTime：页面首次进入隐藏状态的时间戳（核心监控指标）
 */
export const getVisibilityWatcher = () => {
    if (firstHiddenTime < 0) {
        firstHiddenTime = initHiddenTime()

        addChangeListeners()

        onBFCacheRestore(() => {
            setTimeout(() => {
                firstHiddenTime = initHiddenTime()

                addChangeListeners()
            }, 0)
        })
    }

    return {
        get firstHiddenTime() {
            return firstHiddenTime
        },
    }
}
