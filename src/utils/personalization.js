const STORAGE_PREFIX = 'app_personalization_'

export const personalization = {
  saveFieldHistory(fieldName, value) {
    if (!value || value.trim() === '') return
    
    const key = `${STORAGE_PREFIX}field_${fieldName}`
    const history = this.getFieldHistory(fieldName)
    
    if (!history.includes(value)) {
      history.unshift(value)
      if (history.length > 10) {
        history.pop()
      }
      localStorage.setItem(key, JSON.stringify(history))
    }
  },

  getFieldHistory(fieldName) {
    const key = `${STORAGE_PREFIX}field_${fieldName}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  },

  saveFormData(formType, data) {
    const key = `${STORAGE_PREFIX}form_${formType}`
    localStorage.setItem(key, JSON.stringify(data))
  },

  getFormData(formType) {
    const key = `${STORAGE_PREFIX}form_${formType}`
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  },

  savePrinterPreference(type, printerName) {
    const key = `${STORAGE_PREFIX}printer_${type}`
    localStorage.setItem(key, printerName)
  },

  getPrinterPreference(type) {
    const key = `${STORAGE_PREFIX}printer_${type}`
    return localStorage.getItem(key)
  },

  clearAll() {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }
}

