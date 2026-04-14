# DESIGN.md

## 1. Sudoku 边界 / Game 职责

`Sudoku` 表示一个数独局面，只负责盘面本身：保存当前 `grid`、固定格 `fixed`，并提供 `getGrid()`、`guess(move)`、`clone()`、`toJSON()`、`toString()`、冲突检查和完成检查。

`Game` 表示一局游戏会话，负责持有当前 `Sudoku`，并管理 `undoStack` 与 `redoStack`。它对外提供 `guess()`、`undo()`、`redo()`、`canUndo()`、`canRedo()`、`toJSON()` 等接口。

## 2. Move 是值对象还是实体对象？为什么？

我把 `Move` 设计成值对象。它只是一次输入动作的数据，例如 `{ row, col, value }`，没有独立身份，也不需要长期跟踪生命周期，所以不适合做成实体对象。

## 3. 历史中存储的是什么？为什么？

历史中存储的是 `Sudoku` 的快照，也就是 `Sudoku.toJSON()` 的结果，而不是只存 `Move`。其中：

- `undoStack` 保存每次输入前的盘面快照
- `redoStack` 保存被 undo 撤销掉的盘面快照

这样设计更直接，undo/redo 时只需要恢复旧局面，不需要额外记录原值。数独只有 9x9，快照法的空间代价很小，但实现更稳定。

## 4. 复制策略是什么？哪些地方需要深复制？

我的复制策略是：涉及二维数组和历史快照时一律深拷贝，避免共享可变引用。

需要深拷贝的地方有：

- `createSudoku(input)` 时复制输入 `grid`
- `getGrid()` 返回给外部时
- `clone()` 生成新对象时
- `toJSON()` 导出数据时
- `Game` 保存 undo / redo 历史时
- 从 JSON 恢复对象时

如果误用浅拷贝，多个对象可能共享同一个二维数组。这样当前盘面一改，历史记录或克隆对象也会一起被改坏，导致 `clone()` 和 `undo/redo` 失效。

## 5. 序列化 / 反序列化设计是什么？

`Sudoku.toJSON()` 会序列化：

- `grid`
- `fixed`

`createSudokuFromJSON(json)` 用这两个字段重建 `Sudoku` 对象。

`Game.toJSON()` 会序列化：

- `sudoku`
- `undoStack`
- `redoStack`

`createGameFromJSON(json)` 会先恢复当前 `Sudoku`，再恢复历史栈，最后重建完整的 `Game` 对象。

会被序列化的是盘面数据和历史快照；不会被序列化的是对象的方法，因为 JSON 只能保存数据，不能保存函数，所以反序列化时必须重新调用工厂函数。

## 6. 外观化接口是什么？为什么这样设计？

我提供了两种外观化接口：

- `toJSON()`：给程序保存、恢复、测试使用
- `toString()`：给人阅读和调试使用

其中 `Sudoku.toString()` 会把 9x9 盘面格式化成可读文本，空格用 `.` 表示，并按 3x3 宫分隔，避免出现 `[object Object]` 这种无意义输出。

## 7. View 层如何消费领域对象？

本次作业采用的是 **Store Adapter** 方案。Svelte 组件并不直接持有 `Game`，而是继续消费 `@sudoku/stores/grid` 这样的 store。不同的是，这个 store 的内部已经改成持有 `Game` 对象。

View 层直接消费的数据有：

- `grid`：初始题面，用来判断固定格
- `userGrid`：当前界面显示的盘面
- `invalidCells`：冲突格列表
- `canUndo` / `canRedo`：撤销与重做按钮状态
- `gameWon`：是否获胜

用户输入的路径是：

- 键盘按钮调用 `userGrid.set(pos, value)`
- `userGrid.set(...)` 内部转发到 `currentGame.guess(...)`
- Undo / Redo 按钮调用 `userGrid.undo()` / `userGrid.redo()`
- 这些方法再转发到 `Game.undo()` / `Game.redo()`

也就是说，真实界面的主要交互现在已经通过 `Game / Sudoku` 完成，而不是继续直接改旧数组。

## 8. Svelte 响应式机制为什么会更新？

我的方案依赖的是 **Svelte store + `$store` + store.set(...)**。

领域对象 `Game` 本身不是 Svelte store，所以仅仅修改 `currentGame` 的内部字段，界面不会自动刷新。真正让 UI 刷新的原因是：在 `Game` 发生变化后，adapter 会调用：

- `userGridState.set(currentGame.getSudoku().getGrid())`
- `canUndo.set(currentGame.canUndo())`
- `canRedo.set(currentGame.canRedo())`

这样 Svelte 组件中的 `$userGrid`、`$canUndo`、`$canRedo` 才会重新计算并刷新视图。

如果直接 mutate 对象内部字段或直接改二维数组元素，而不重新 `.set(...)` 到 store，就可能出现“数据变了但界面没有按预期更新”的问题。

## 9. 相比 HW1，我改进了什么？

HW1 中虽然已经实现了 `Sudoku / Game`，但它们主要只在测试中使用，真实 Svelte 界面仍然通过旧 store 和旧数组工作，所以领域对象没有真正进入真实游戏流程。

HW1.1 中，我新增了 store adapter，让 `grid.js` 内部持有 `Game`，并把当前盘面、撤销重做状态等以 Svelte store 的形式暴露给 UI。这样组件层只负责：

- 读取 store 来渲染
- 调用 store 暴露的方法来交互

相比 HW1，这样的设计更适合真实前端项目。它的 trade-off 是多了一层 adapter，需要在领域对象变化后手动同步到 store，但换来的是更清晰的边界和更正确的响应式更新。
