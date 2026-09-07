/** Keep source failures visible even when another source succeeds. */
export async function combineSources(sources) {
  const results = await Promise.allSettled(sources.map(([, load]) => load()));
  const events = [], warnings = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') events.push(...result.value);
    else warnings.push(`${sources[index][0]}：${result.reason?.message || '暂不可用'}`);
  });
  if (results.every(result => result.status === 'rejected')) throw new Error(warnings.join('；'));
  return { events, warning: warnings.join('；') };
}
