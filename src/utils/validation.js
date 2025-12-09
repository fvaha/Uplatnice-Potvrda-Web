export const validators = {
  jmbg(value) {
    if (!value) return { valid: false, error: 'JMBG je obavezan' }
    const jmbg = String(value).replace(/\D/g, '')
    if (jmbg.length !== 13) {
      return { valid: false, error: 'JMBG mora imati 13 cifara' }
    }
    
    const datePart = jmbg.substring(0, 7)
    const day = parseInt(datePart.substring(0, 2))
    const month = parseInt(datePart.substring(2, 4))
    const year = parseInt(datePart.substring(4, 7))
    
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return { valid: false, error: 'Nevažeći datum u JMBG-u' }
    }
    
    return { valid: true }
  },

  pib(value) {
    if (!value) return { valid: true }
    const pib = String(value).replace(/\D/g, '')
    if (pib.length !== 9) {
      return { valid: false, error: 'PIB mora imati 9 cifara' }
    }
    return { valid: true }
  },

  racun(value) {
    if (!value) return { valid: true }
    const racun = String(value).replace(/\D/g, '')
    if (racun.length < 10 || racun.length > 18) {
      return { valid: false, error: 'Broj računa mora imati između 10 i 18 cifara' }
    }
    
    if (racun.startsWith('265')) {
      const iban = `RS${racun}`
      if (iban.length === 22) {
        return { valid: true, formatted: iban }
      }
    }
    
    return { valid: true }
  },

  pozivNaBroj(value) {
    if (!value) return { valid: true }
    const poziv = String(value).replace(/\D/g, '')
    if (poziv.length < 1 || poziv.length > 20) {
      return { valid: false, error: 'Poziv na broj mora imati između 1 i 20 cifara' }
    }
    return { valid: true }
  },

  iznos(value) {
    if (!value) return { valid: false, error: 'Iznos je obavezan' }
    const iznos = parseFloat(value)
    if (isNaN(iznos) || iznos <= 0) {
      return { valid: false, error: 'Iznos mora biti pozitivan broj' }
    }
    return { valid: true, formatted: iznos.toFixed(2) }
  }
}

export function validateField(fieldName, value) {
  const validator = validators[fieldName]
  if (!validator) {
    return { valid: true }
  }
  return validator(value)
}

export function validateForm(formData, fields) {
  const errors = {}
  let isValid = true

  fields.forEach(field => {
    const result = validateField(field.name, formData[field.name])
    if (!result.valid) {
      errors[field.name] = result.error
      isValid = false
    }
  })

  return { isValid, errors }
}

