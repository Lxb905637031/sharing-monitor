import { onHidden } from './onHidden.js'
import { runOnce } from './runOnce.js'

/**
 * 空闲执行函数：优先在浏览器空闲时执行回调，页面隐藏时立即执行（兜底）
 * 核心设计：兼顾性能（空闲执行）与可靠性（页面隐藏时不丢失执行）
 * @param {() => void} cb - 待执行的回调函数（会被包装为仅执行一次）
 * @returns {number} 执行句柄（用于取消执行：requestIdleCallback/setTimeout的返回值）
 */
export const whenIdle = (cb: () => void): number => {
    // 1. 兼容获取空闲执行API：优先使用requestIdleCallback，降级为setTimeout
    // requestIdleCallback：浏览器空闲时执行（不阻塞渲染）；setTimeout：兜底（低版本浏览器兼容）
    const rIC = self.requestIdleCallback || self.setTimeout

    // 2. 初始化执行句柄（默认-1，表示未注册）
    let handle = -1
    // 3. 包装回调为「仅执行一次」：避免页面隐藏+空闲时重复执行
    cb = runOnce(cb)

    // 4. 执行策略判定：
    if (document.visibilityState === 'hidden') {
        // 场景1：页面已隐藏（如用户切标签/最小化）→ 立即执行回调（避免空闲执行永远不触发）
        cb()
    } else {
        // 场景2：页面可见 → 优先注册空闲执行
        handle = rIC(cb)
        // 兜底：监听页面隐藏事件，若空闲执行前页面隐藏，立即执行回调
        onHidden(cb)
    }

    // 返回执行句柄，供外部取消执行（如：cancelIdleCallback(handle)/clearTimeout(handle)）
    return handle
}
