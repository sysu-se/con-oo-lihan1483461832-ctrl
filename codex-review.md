# con-oo-lihan1483461832-ctrl - Review

## Review 结论

代码已经把 `Game` / `Sudoku` 接到了真实的开局、输入、撤销和重做流程里，不属于“领域对象只存在于测试里”的情况；但当前实现还没有让领域对象成为唯一业务真相源，冲突判断、胜利判断和部分游戏行为仍散落在 Svelte store / 组件侧，`Sudoku` 自身的不变量校验也不够严格，因此整体完成度可以认为是“已接入，但设计质量中等，仍有核心建模问题未收口”。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | fair |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. Sudoku 对 fixed mask 的不变量校验不足

- 严重程度：core
- 位置：src/domain/Sudoku.js:55-64,185-190,368-373
- 原因：`validateFixedMask` 只检查了 9x9 形状，没有检查元素是否为 boolean，也没有检查 `fixed` 与 `grid` 是否一致。这样 `createSudokuFromJSON` 可以恢复出“空格却不可填”或“题面 givens 却可修改”的非法状态，破坏领域对象应维护的核心业务约束。

### 2. 冲突判断和胜利判断没有以领域对象为唯一真相源

- 严重程度：core
- 位置：src/node_modules/@sudoku/stores/grid.js:244-304; src/node_modules/@sudoku/stores/game.js:7-18; src/App.svelte:12-16
- 原因：`Sudoku` 已经提供了 `isConflictingCell()` / `isComplete()`，但 Svelte 接入层仍然基于原始二维数组重新推导 `invalidCells` 和 `gameWon`。这使关键业务规则同时存在于领域层和 UI 侧两份实现中，后续一旦规则调整就容易出现分叉，说明领域对象还没有真正成为核心模型。

### 3. Svelte 适配层被拆成多个手工同步的 store，缺少统一的 Game store

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:43-76,163-225; src/node_modules/@sudoku/game.js:13-34
- 原因：`currentGame` 被隐藏为模块级可变变量，UI 读取的却是 `userGrid`、`canUndo`、`canRedo`、`gamePaused` 等分散状态；每次变更都依赖显式调用 `syncStoresFromGame()`。这种做法能工作，但不是一个内聚的 OOD 设计，也不够符合推荐的 Svelte store adapter 思路，后续很容易因为漏同步而产生陈旧 UI。

### 4. 便签模式会把用户已填写的数字直接清空

- 严重程度：major
- 位置：src/components/Controls/Keyboard.svelte:10-18; src/node_modules/@sudoku/stores/keyboard.js:6-10
- 原因：在 notes 模式下，按数字键会先修改 candidates，再无条件执行 `userGrid.set($cursor, 0)`。而 `keyboardDisabled` 只禁止题面 givens，并不禁止“用户自己已经填过的可编辑格”，因此对一个已填值的普通空格记笔记时，会把现有答案清掉，这不符合数独交互习惯。

### 5. 提示逻辑绕过了 Game 的统一操作边界

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:193-208
- 原因：`applyHint()` 在 store 中直接求解当前棋盘、扣减 hint、再调用 `currentGame.guess()`。这意味着并非所有游戏动作都通过 `Game` 统一建模，提示消耗与实际落子也不是一个原子操作，领域层对完整游戏流程的封装仍然偏弱。

### 6. Game 对 Sudoku 合同的运行时校验不完整

- 严重程度：minor
- 位置：src/domain/Game.js:39-41,72-75,163-168
- 原因：`createGameInternal` 只检查了 `clone` 和 `toJSON`，但后续实际还依赖 `guess` 和 `toString`。在 JS 的 duck typing 风格下，这种不完整合同会让错误延迟到运行过程中才暴露，接口边界不够严谨。

## 优点

### 1. 领域对象对内部可变状态做了外部隔离

- 位置：src/domain/Sudoku.js:201-212,248-249,312-316; src/domain/Game.js:59-60,149-154
- 原因：`getGrid()`、`getFixedMask()`、`clone()`、`toJSON()`、`getSudoku()` 都返回副本而非裸引用，避免了 UI 或调用方直接篡改内部状态，这对 OOP 封装和 undo/redo 快照都很重要。

### 2. Game 与 Sudoku 的职责边界比“把历史写进组件”清晰得多

- 位置：src/domain/Game.js:72-123
- 原因：`Sudoku` 负责单盘状态和落子，`Game` 负责历史栈、撤销和重做，至少在核心建模上已经把历史管理从视图层抽离出来了。

### 3. 领域对象已经接入真实 Svelte 游戏主流程

- 位置：src/node_modules/@sudoku/stores/grid.js:84-93,173-225; src/components/Modal/Types/Welcome.svelte:16-23; src/components/Controls/ActionBar/Actions.svelte:13-19; src/components/Controls/Keyboard.svelte:19-25
- 原因：开始新局、加载自定义题目、填写数字、撤销和重做都经过了 `currentGame` / `Sudoku.guess()`，说明这次提交并不是“只写了可测试对象但 UI 仍走旧逻辑”。

### 4. Sudoku 暴露了明确的领域查询接口

- 位置：src/domain/Sudoku.js:260-304
- 原因：`isConflictingCell()`、`isValidBoard()`、`isComplete()` 这些查询接口语义清晰，说明作者已经在尝试把“棋盘是否合法/是否完成”建模为领域能力，而不是纯数组工具函数。

### 5. 默认 fixed mask 的推导符合标准数独语义

- 位置：src/domain/Sudoku.js:67-77,185-188
- 原因：通过初始棋盘中非 0 格自动生成 givens，能正确表达“题目原有数字不可修改”的业务规则，对正常生成或加载的题面是合理的。

## 补充说明

- 本次结论仅基于静态阅读；按要求未运行测试，也未做实际点击交互验证。
- 评审范围限制在 `src/domain/*` 及其接入到 Svelte 流程的相关文件，包括 `src/App.svelte`、`src/components/*` 和 `src/node_modules/@sudoku/*` 中直接参与游戏流程的模块。
- 关于“便签模式会清空已填数字”“提示逻辑未形成原子事务”等判断，来自代码路径推导，不是运行后的黑盒观察结果。
