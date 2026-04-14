import { createSudokuFromJSON } from './Sudoku.js'

/**
 * 使用 JSON 的方式做深拷贝。
 * 适合这里这种普通对象/数组的数据快照。
 *
 * @param {any} value 要复制的数据
 * @returns {any} 复制后的新数据
 */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 复制一组历史快照。
 * undoStack 和 redoStack 里保存的都是普通 JSON 数据，
 * 这里逐个深拷贝，避免外部修改影响内部状态。
 *
 * @param {Array<Object>} list 快照数组
 * @returns {Array<Object>} 复制后的新数组
 */
function copySnapshotList(list) {
  return list.map((item) => deepCopy(item))
}

/**
 * 创建 Game 对象的内部函数。
 * 它负责维护：
 * 1. 当前的 sudoku
 * 2. undo 历史
 * 3. redo 历史
 *
 * @param {Object} options 配置对象
 * @param {Object} options.sudoku 当前数独对象
 * @param {Array<Object>} [options.undoStack=[]] undo 历史
 * @param {Array<Object>} [options.redoStack=[]] redo 历史
 * @returns {Object} Game 对象
 */
function createGameInternal({ sudoku, undoStack = [], redoStack = [] }) {
  if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.toJSON !== 'function') {
    throw new Error('createGame requires a valid sudoku object.')
  }

  /** @type {Object} 当前正在使用的数独对象 */
  let currentSudoku = sudoku.clone()

  /** @type {Array<Object>} 撤销历史栈 */
  let undoStackData = copySnapshotList(undoStack)

  /** @type {Array<Object>} 重做历史栈 */
  let redoStackData = copySnapshotList(redoStack)

  /**
   * 获取当前数独对象的副本。
   * 返回 clone 是为了防止外部直接改内部状态。
   *
   * @returns {Object} 当前数独的副本
   */
  function getSudoku() {
    return currentSudoku.clone()
  }

  /**
   * 执行一次填数操作。
   * 如果操作成功：
   * 1. 先把旧状态压入 undo 栈
   * 2. 清空 redo 栈
   *
   * @param {Object} move 一次操作的信息
   * @returns {boolean} 是否修改成功
   */
  function guess(move) {
    const oldSnapshot = currentSudoku.toJSON()
    const success = currentSudoku.guess(move)

    if (!success) {
      return false
    }

    undoStackData.push(oldSnapshot)
    redoStackData = []
    return true
  }

  /**
   * 撤销上一步操作。
   * 如果 undo 栈为空，说明不能撤销。
   *
   * @returns {boolean} 是否撤销成功
   */
  function undo() {
    if (undoStackData.length === 0) {
      return false
    }

    const currentSnapshot = currentSudoku.toJSON()
    redoStackData.push(currentSnapshot)

    const previousSnapshot = undoStackData.pop()
    currentSudoku = createSudokuFromJSON(previousSnapshot)

    return true
  }

  /**
   * 重做上一次被撤销的操作。
   * 如果 redo 栈为空，说明不能重做。
   *
   * @returns {boolean} 是否重做成功
   */
  function redo() {
    if (redoStackData.length === 0) {
      return false
    }

    const currentSnapshot = currentSudoku.toJSON()
    undoStackData.push(currentSnapshot)

    const nextSnapshot = redoStackData.pop()
    currentSudoku = createSudokuFromJSON(nextSnapshot)

    return true
  }

  /**
   * 判断当前是否可以撤销。
   *
   * @returns {boolean} 是否可以 undo
   */
  function canUndo() {
    return undoStackData.length > 0
  }

  /**
   * 判断当前是否可以重做。
   *
   * @returns {boolean} 是否可以 redo
   */
  function canRedo() {
    return redoStackData.length > 0
  }

  /**
   * 把整个游戏状态转成 JSON。
   * 这样可以用于保存、传输或恢复。
   *
   * @returns {Object} 当前游戏状态的 JSON 数据
   */
  function toJSON() {
    return {
      sudoku: currentSudoku.toJSON(),
      undoStack: copySnapshotList(undoStackData),
      redoStack: copySnapshotList(redoStackData),
    }
  }

  /**
   * 返回当前游戏的字符串描述。
   * 主要用于调试和查看状态。
   *
   * @returns {string} 游戏状态字符串
   */
  function toString() {
    return [
      '[Game]',
      `canUndo=${canUndo()}`,
      `canRedo=${canRedo()}`,
      currentSudoku.toString(),
    ].join('\n')
  }

  return {
    getSudoku,
    guess,
    undo,
    redo,
    canUndo,
    canRedo,
    toJSON,
    toString,
  }
}

/**
 * 创建一个新的游戏对象。
 *
 * @param {Object} options 配置对象
 * @param {Object} options.sudoku 初始数独对象
 * @returns {Object} Game 对象
 */
export function createGame({ sudoku }) {
  return createGameInternal({ sudoku })
}

/**
 * 根据 JSON 数据恢复一个游戏对象。
 *
 * @param {Object} json 保存下来的游戏 JSON
 * @returns {Object} Game 对象
 */
export function createGameFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid game JSON.')
  }

  return createGameInternal({
    sudoku: createSudokuFromJSON(json.sudoku),
    undoStack: Array.isArray(json.undoStack) ? json.undoStack : [],
    redoStack: Array.isArray(json.redoStack) ? json.redoStack : [],
  })
}
