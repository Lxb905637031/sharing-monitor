interface onBFCacheRestoreCallback {
    (event: PageTransitionEvent): void
}

/**
 * 记录页面从BFCache恢复的时间戳（初始值-1表示未触发过BFCache恢复）
 * timeStamp单位为毫秒，对应事件触发时的时间戳（基于浏览器性能计时）
 */
let bfcacheRestoreTime = -1

/**
 * 获取页面从BFCache恢复的时间戳
 * @returns {number} 恢复时间戳（-1表示未触发，非-1表示触发时的timeStamp）
 */
export const getBFCacheRestoreTime = () => bfcacheRestoreTime

/**
 * 注册BFCache恢复事件监听，页面从BFCache缓存恢复时执行回调
 * @param cb - 符合onBFCacheRestoreCallback类型的回调函数，接收PageTransitionEvent事件对象
 */
export const onBFCacheRestore = (cb: onBFCacheRestoreCallback) => {
    addEventListener(
        'pageshow',
        event => {
            if (event.persisted) {
                bfcacheRestoreTime = event.timeStamp
                cb(event)
            }
        },
        true
    )
}
