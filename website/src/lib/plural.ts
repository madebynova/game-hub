/** "0 titles", "1 title", "12 titles" — used wherever a library count shows. */
export function countLabel(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}
