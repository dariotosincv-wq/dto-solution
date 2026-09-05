// Same logical keys and JSON payloads as Driver Utility; browser storage only.
export const Preferences = {
  async get({ key }: { key: string }) {
    return { value: window.localStorage.getItem(key) }
  },
  async set({ key, value }: { key: string; value: string }) {
    window.localStorage.setItem(key, value)
  },
  async remove({ key }: { key: string }) {
    window.localStorage.removeItem(key)
  },
}
