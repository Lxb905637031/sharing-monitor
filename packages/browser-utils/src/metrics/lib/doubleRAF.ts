/**
 * 双层 requestAnimationFrame (RAF) 封装函数
 * 作用：延迟回调函数执行到「下两个浏览器重绘帧」，确保在DOM渲染完成后执行（比单层RAF更稳定）
 * @param cb - 待执行的回调函数，无参数，返回值为任意类型（unknown）且不做使用
 */
export const doubleRAF = (cb: () => unknown) => {
    requestAnimationFrame(() => requestAnimationFrame(() => cb()))
}
