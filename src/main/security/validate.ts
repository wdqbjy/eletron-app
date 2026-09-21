/**
 * IPC 入参校验小工具（无第三方依赖）
 * 原则：对从渲染层进入主进程的每一个 IPC 参数做白名单式校验，
 * 类型 / 长度 / 取值域不对就直接拒绝，绝不让脏数据流进业务逻辑。
 */

export class ParamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParamError'
  }
}

/** 非空字符串，长度上限可配 */
export function nonEmptyString(v: unknown, field: string, max = 512, min = 1): string {
  if (typeof v !== 'string') throw new ParamError(`${field} 必须是字符串`)
  const s = v.trim()
  if (s.length < min || s.length > max) {
    throw new ParamError(`${field} 长度必须在 ${min}~${max} 之间`)
  }
  return s
}

/** 整数，且在 [min, max] 闭区间内；允许缺省（fallback） */
export function boundedInt(v: unknown, field: string, min: number, max: number, fallback?: number): number {
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback
    throw new ParamError(`${field} 不能为空`)
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new ParamError(`${field} 必须是 ${min}~${max} 的整数`)
  }
  return v
}

/** 普通对象（不允许数组 / null / 其它类型） */
export function plainObject(v: unknown, field: string, allowedKeys?: readonly string[]): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new ParamError(`${field} 必须是普通对象`)
  }
  const obj = v as Record<string, unknown>
  if (allowedKeys) {
    for (const key of Object.keys(obj)) {
      if (!allowedKeys.includes(key)) {
        throw new ParamError(`${field} 不允许的字段: ${key}`)
      }
    }
  }
  return obj
}

/** 文件名等需落盘的路径片段：拒绝一切路径分隔与空名字 */
export function fileName(v: unknown, field: string, max = 100): string {
  const s = nonEmptyString(v, field, max)
  if (/[<>:"/\\|?*\x00-\x1f]/.test(s)) {
    throw new ParamError(`${field} 包含非法字符`)
  }
  return s
}
