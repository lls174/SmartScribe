// 简单的测试文件
const sum = (a, b) => a + b

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3)
})