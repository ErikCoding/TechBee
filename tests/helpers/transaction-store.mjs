// Optimistic transaction test double: callbacks retry on concurrent commits;
// exceptions never publish staged writes. Queries participate in the read version.
export function transactionStore(initial) {
  let state = new Map(Object.entries(structuredClone(initial)))
  let version = 0
  let attempts = 0
  let failNextCommit = false
  const snapshot = (ref, data) => ({ id: ref.id, ref, exists: data !== undefined, data: () => structuredClone(data) })
  function reference(path, filters = [], isCollection = false) {
    return {
      path, filters, isCollection, id: path.split('/').at(-1),
      doc(id = `auto-${++sequence}`) { return reference(`${path}/${id}`) },
      collection(name) { return reference(`${path}/${name}`, [], true) },
      where(field, op, value) { return reference(path, [...filters, [field, op, value]], true) },
      async get() { return read(this, state) },
      async add(data) { const ref = this.doc(); state.set(ref.path, structuredClone(data)); version++; return ref },
    }
  }
  let sequence = 0
  function read(ref, source) {
    if (!ref.isCollection) return snapshot(ref, source.get(ref.path))
    const docs = [...source].filter(([path, data]) => path.startsWith(`${ref.path}/`)
      && path.split('/').length === ref.path.split('/').length + 1
      && ref.filters.every(([field, op, value]) => op === 'in' ? value.includes(data[field]) : data[field] === value))
      .map(([path, data]) => snapshot(reference(path), data))
    return { docs, empty: !docs.length, size: docs.length }
  }
  return {
    collection: (path) => reference(path, [], true), doc: reference,
    data: (path) => structuredClone(state.get(path)),
    entries: () => [...state.entries()],
    attempts: () => attempts,
    failCommit: () => { failNextCommit = true },
    async runTransaction(callback) {
      for (let retry = 0; retry < 10; retry++) {
        attempts++
        const readVersion = version
        const source = structuredClone(state)
        const writes = []
        const result = await callback({
          async get(ref) {
            if (writes.length) throw new Error('Read after write')
            return read(ref, source)
          },
          set(ref, data, options) { writes.push([options?.merge ? 'merge' : 'set', ref, structuredClone(data)]) },
          update(ref, data) { writes.push(['update', ref, structuredClone(data)]) },
          delete(ref) { writes.push(['delete', ref]) },
        })
        if (version !== readVersion) continue
        if (failNextCommit) { failNextCommit = false; throw new Error('Firestore unavailable') }
        const next = new Map(state)
        for (const [op, ref, data] of writes) {
          if (op === 'delete') next.delete(ref.path)
          else if (op === 'update') {
            if (!next.has(ref.path)) throw new Error('Missing document')
            next.set(ref.path, { ...next.get(ref.path), ...data })
          } else if (op === 'merge') next.set(ref.path, { ...next.get(ref.path), ...data })
          else next.set(ref.path, data)
        }
        if (writes.length) { state = next; version++ }
        return result
      }
      throw new Error('Transaction retry limit')
    },
  }
}
