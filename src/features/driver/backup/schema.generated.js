// Generated from original TypeScript types; run node scripts/generate-driver-backup-schema.mjs.
export default {
  "provenance": {
    "generator": "scripts/generate-driver-backup-schema.mjs",
    "typescript": "5.8.3",
    "sources": [
      {
        "file": "vendor/driver-utility/src/lib/driverPayrollTypes.ts",
        "sha256": "3916165f26bd4b7bd90a8c599fe75b59cb8c4e31f4c3afc58310d6cc6cce8538"
      },
      {
        "file": "vendor/driver-utility/src/lib/driverPayrollFiscalTypes.ts",
        "sha256": "1b1585549551337e8ffb6b44571968ab1d95df68ae3b877564e10243e47c4784"
      },
      {
        "file": "vendor/driver-utility/src/lib/driverContractProfile.ts",
        "sha256": "2977b0883fbb2a16d2fabded069210e9d761443809976a00210d9cc665290f29"
      }
    ]
  },
  "payroll": {
    "ref": "d0"
  },
  "contract": {
    "ref": "d28"
  },
  "definitions": {
    "d0": {
      "type": "object",
      "properties": {
        "profiles": {
          "type": "array",
          "items": {
            "ref": "d1"
          }
        },
        "contractSources": {
          "type": "array",
          "items": {
            "ref": "d2"
          }
        },
        "rules": {
          "type": "array",
          "items": {
            "ref": "d3"
          }
        },
        "codes": {
          "type": "array",
          "items": {
            "ref": "d5"
          }
        },
        "payslips": {
          "type": "array",
          "items": {
            "ref": "d6"
          }
        },
        "predictions": {
          "type": "array",
          "items": {
            "ref": "d20"
          }
        },
        "comparisons": {
          "type": "array",
          "items": {
            "ref": "d23"
          }
        },
        "learningProfile": {
          "type": "array",
          "items": {
            "ref": "d25"
          }
        }
      },
      "required": [
        "profiles",
        "contractSources",
        "rules",
        "codes",
        "payslips",
        "predictions",
        "comparisons",
        "learningProfile"
      ]
    },
    "d1": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "displayName": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "companyName": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "siteCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "contractCode": {
          "type": "string"
        },
        "payrollProvider": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "level": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "employmentType": {
          "anyOf": [
            {
              "const": "full_time"
            },
            {
              "const": "part_time_orizzontale"
            },
            {
              "const": "part_time_verticale"
            },
            {
              "const": "part_time_misto"
            }
          ]
        },
        "weeklyHours": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "monthlyTheoreticalHours": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "hireDate": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "seniorityDate": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "nextSeniorityIncreaseDate": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "province": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "region": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "hasUnionFee": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "unionFeeAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "hasEbilogContribution": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "notes": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": [
        "id",
        "contractCode",
        "employmentType"
      ]
    },
    "d2": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "type": {
          "anyOf": [
            {
              "const": "ccnl"
            },
            {
              "const": "accordo_nazionale"
            },
            {
              "const": "accordo_aziendale"
            },
            {
              "const": "nota_interna"
            }
          ]
        },
        "validFrom": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "validTo": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "version": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "documentName": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "pages": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        }
      },
      "required": [
        "id",
        "title",
        "type"
      ]
    },
    "d3": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "code": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "category": {
          "anyOf": [
            {
              "const": "base_pay"
            },
            {
              "const": "edr"
            },
            {
              "const": "epa"
            },
            {
              "const": "seniority_increment"
            },
            {
              "const": "contractual_allowance"
            },
            {
              "const": "allowance"
            },
            {
              "const": "travel_allowance"
            },
            {
              "const": "meal_allowance"
            },
            {
              "const": "mileage_reimbursement"
            },
            {
              "const": "generic_allowance"
            },
            {
              "const": "overtime"
            },
            {
              "const": "overtime_premium"
            },
            {
              "const": "night_premium"
            },
            {
              "const": "sunday_premium"
            },
            {
              "const": "holiday_premium"
            },
            {
              "const": "shift_premium"
            },
            {
              "const": "generic_premium"
            },
            {
              "const": "absence"
            },
            {
              "const": "paid_leave"
            },
            {
              "const": "vacation"
            },
            {
              "const": "permission"
            },
            {
              "const": "former_holiday_leave"
            },
            {
              "const": "sickness"
            },
            {
              "const": "sickness_waiting_period"
            },
            {
              "const": "sickness_employer_supplement"
            },
            {
              "const": "injury"
            },
            {
              "const": "accident"
            },
            {
              "const": "accident_employer_supplement"
            },
            {
              "const": "unpaid_absence"
            },
            {
              "const": "strike"
            },
            {
              "const": "rest_day"
            },
            {
              "const": "holiday"
            },
            {
              "const": "bonus"
            },
            {
              "const": "thirteenth_month"
            },
            {
              "const": "fourteenth_month"
            },
            {
              "const": "performance_bonus"
            },
            {
              "const": "production_bonus"
            },
            {
              "const": "welfare"
            },
            {
              "const": "fringe_benefit"
            },
            {
              "const": "generic_bonus"
            },
            {
              "const": "reimbursement"
            },
            {
              "const": "expense_reimbursement"
            },
            {
              "const": "employee_social_contribution"
            },
            {
              "const": "employer_social_contribution"
            },
            {
              "const": "bilateral_body_employee_contribution"
            },
            {
              "const": "bilateral_body_employer_contribution"
            },
            {
              "const": "union_fee"
            },
            {
              "const": "salary_advance"
            },
            {
              "const": "salary_advance_recovery"
            },
            {
              "const": "generic_deduction"
            },
            {
              "const": "deduction"
            },
            {
              "const": "tax"
            },
            {
              "const": "income_tax"
            },
            {
              "const": "regional_tax"
            },
            {
              "const": "municipal_tax_balance"
            },
            {
              "const": "municipal_tax_advance"
            },
            {
              "const": "tax_deduction"
            },
            {
              "const": "tax_credit"
            },
            {
              "const": "tax_adjustment"
            },
            {
              "const": "contribution"
            },
            {
              "const": "worked_hours"
            },
            {
              "const": "worked_days"
            },
            {
              "const": "theoretical_hours"
            },
            {
              "const": "effective_hours"
            },
            {
              "const": "social_security_taxable"
            },
            {
              "const": "income_tax_taxable"
            },
            {
              "const": "tfr_taxable"
            },
            {
              "const": "informational"
            },
            {
              "const": "accrual"
            },
            {
              "const": "other"
            }
          ]
        },
        "sourceIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "validFrom": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "validTo": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "appliesWhen": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "doesNotApplyWhen": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "formula": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "parameters": {
          "anyOf": [
            {
              "ref": "d4"
            }
          ]
        },
        "examples": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "exceptions": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "notes": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        }
      },
      "required": [
        "id",
        "code",
        "name",
        "category",
        "sourceIds",
        "appliesWhen",
        "doesNotApplyWhen"
      ]
    },
    "d4": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "number"
          },
          {
            "const": false
          },
          {
            "const": true
          }
        ]
      }
    },
    "d5": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string"
        },
        "label": {
          "type": "string"
        },
        "normalizedName": {
          "type": "string"
        },
        "type": {
          "anyOf": [
            {
              "const": "deduction"
            },
            {
              "const": "informational"
            },
            {
              "const": "earning"
            },
            {
              "const": "neutral"
            }
          ]
        },
        "category": {
          "anyOf": [
            {
              "const": "base_pay"
            },
            {
              "const": "edr"
            },
            {
              "const": "epa"
            },
            {
              "const": "seniority_increment"
            },
            {
              "const": "contractual_allowance"
            },
            {
              "const": "allowance"
            },
            {
              "const": "travel_allowance"
            },
            {
              "const": "meal_allowance"
            },
            {
              "const": "mileage_reimbursement"
            },
            {
              "const": "generic_allowance"
            },
            {
              "const": "overtime"
            },
            {
              "const": "overtime_premium"
            },
            {
              "const": "night_premium"
            },
            {
              "const": "sunday_premium"
            },
            {
              "const": "holiday_premium"
            },
            {
              "const": "shift_premium"
            },
            {
              "const": "generic_premium"
            },
            {
              "const": "absence"
            },
            {
              "const": "paid_leave"
            },
            {
              "const": "vacation"
            },
            {
              "const": "permission"
            },
            {
              "const": "former_holiday_leave"
            },
            {
              "const": "sickness"
            },
            {
              "const": "sickness_waiting_period"
            },
            {
              "const": "sickness_employer_supplement"
            },
            {
              "const": "injury"
            },
            {
              "const": "accident"
            },
            {
              "const": "accident_employer_supplement"
            },
            {
              "const": "unpaid_absence"
            },
            {
              "const": "strike"
            },
            {
              "const": "rest_day"
            },
            {
              "const": "holiday"
            },
            {
              "const": "bonus"
            },
            {
              "const": "thirteenth_month"
            },
            {
              "const": "fourteenth_month"
            },
            {
              "const": "performance_bonus"
            },
            {
              "const": "production_bonus"
            },
            {
              "const": "welfare"
            },
            {
              "const": "fringe_benefit"
            },
            {
              "const": "generic_bonus"
            },
            {
              "const": "reimbursement"
            },
            {
              "const": "expense_reimbursement"
            },
            {
              "const": "employee_social_contribution"
            },
            {
              "const": "employer_social_contribution"
            },
            {
              "const": "bilateral_body_employee_contribution"
            },
            {
              "const": "bilateral_body_employer_contribution"
            },
            {
              "const": "union_fee"
            },
            {
              "const": "salary_advance"
            },
            {
              "const": "salary_advance_recovery"
            },
            {
              "const": "generic_deduction"
            },
            {
              "const": "deduction"
            },
            {
              "const": "tax"
            },
            {
              "const": "income_tax"
            },
            {
              "const": "regional_tax"
            },
            {
              "const": "municipal_tax_balance"
            },
            {
              "const": "municipal_tax_advance"
            },
            {
              "const": "tax_deduction"
            },
            {
              "const": "tax_credit"
            },
            {
              "const": "tax_adjustment"
            },
            {
              "const": "contribution"
            },
            {
              "const": "worked_hours"
            },
            {
              "const": "worked_days"
            },
            {
              "const": "theoretical_hours"
            },
            {
              "const": "effective_hours"
            },
            {
              "const": "social_security_taxable"
            },
            {
              "const": "income_tax_taxable"
            },
            {
              "const": "tfr_taxable"
            },
            {
              "const": "informational"
            },
            {
              "const": "accrual"
            },
            {
              "const": "other"
            }
          ]
        },
        "linkedRuleIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "sign": {
          "anyOf": [
            {
              "const": "positive"
            },
            {
              "const": "negative"
            },
            {
              "const": "mixed"
            }
          ]
        },
        "isTaxable": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "affectsTfr": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "affectsInps": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "affectsIrpef": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "parserAliases": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "examples": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        }
      },
      "required": [
        "code",
        "label",
        "normalizedName",
        "type",
        "category",
        "linkedRuleIds",
        "sign",
        "parserAliases"
      ]
    },
    "d6": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "driverProfileId": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "sourceFileHash": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "payrollProvider": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "companyName": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "payrollPeriodLabel": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "level": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "siteCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "costCenterCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "costCenterDescription": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "activityCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "siteCostCenter": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "year": {
          "type": "number"
        },
        "month": {
          "type": "number"
        },
        "importedAt": {
          "type": "string"
        },
        "extractionMethod": {
          "anyOf": [
            {
              "const": "pdf_text"
            },
            {
              "const": "ocr"
            },
            {
              "const": "manual"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "detectedFormat": {
          "anyOf": [
            {
              "const": "logisticsLayoutV1"
            },
            {
              "const": "generic"
            },
            {
              "const": "unknown"
            }
          ]
        },
        "parserUsed": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "fieldConfidence": {
          "anyOf": [
            {
              "ref": "d7"
            }
          ]
        },
        "parsedLines": {
          "type": "array",
          "items": {
            "ref": "d9"
          }
        },
        "summary": {
          "ref": "d10"
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "fiscalDataVersion": {
          "anyOf": [
            {
              "const": "fiscal-v1"
            }
          ]
        },
        "fiscalData": {
          "anyOf": [
            {
              "ref": "d11"
            }
          ]
        }
      },
      "required": [
        "id",
        "year",
        "month",
        "importedAt",
        "extractionMethod",
        "parsedLines",
        "summary",
        "warnings"
      ]
    },
    "d7": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": {
        "ref": "d8"
      }
    },
    "d8": {
      "type": "object",
      "properties": {
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "sourceLabel": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "page": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "const": "confirmed"
            },
            {
              "const": "probable"
            },
            {
              "const": "uncertain"
            },
            {
              "const": "missing"
            }
          ]
        },
        "parserUsed": {
          "type": "string"
        }
      },
      "required": [
        "confidence",
        "parserUsed"
      ]
    },
    "d9": {
      "type": "object",
      "properties": {
        "code": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "label": {
          "type": "string"
        },
        "originalCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "originalDescription": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "normalizedDescription": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "classification": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "category": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "quantity": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "quantityUnit": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "hours"
            },
            {
              "const": "days"
            },
            {
              "const": "months"
            },
            {
              "const": "percentage"
            },
            {
              "const": "units"
            }
          ]
        },
        "unitValue": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "amount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "earningAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "deductionAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "informationalValue": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "section": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "type": {
          "anyOf": [
            {
              "const": "deduction"
            },
            {
              "const": "informational"
            },
            {
              "const": "earning"
            },
            {
              "const": "neutral"
            }
          ]
        },
        "economicType": {
          "anyOf": [
            {
              "const": "deduction"
            },
            {
              "const": "informational"
            },
            {
              "const": "earning"
            },
            {
              "const": "neutral"
            }
          ]
        },
        "sourceColumn": {
          "anyOf": [
            {
              "const": "informational"
            },
            {
              "const": "unit_value"
            },
            {
              "const": "quantity"
            },
            {
              "const": "earnings"
            },
            {
              "const": "deductions"
            }
          ]
        },
        "linkedPayrollCode": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "linkedRuleId": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "sourcePage": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "sourceRowY": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "geometricEconomicCertified": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "economicSelectionResult": {
          "anyOf": [
            {
              "const": "included"
            },
            {
              "const": "excluded"
            },
            {
              "const": "pending"
            }
          ]
        },
        "economicSelectionExclusionReason": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "interpretationMethod": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "canonicalKey": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "classificationMethod": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "exact_company_code"
            },
            {
              "const": "exact_generic_code"
            },
            {
              "const": "description_alias"
            },
            {
              "const": "description_pattern"
            }
          ]
        },
        "classificationConfidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "classificationAmbiguous": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "classificationAlternatives": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "calculationRule": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "percentage"
            },
            {
              "const": "unit_times_quantity"
            },
            {
              "const": "fixed_amount"
            },
            {
              "const": "external_calculation"
            }
          ]
        }
      },
      "required": [
        "label"
      ]
    },
    "d10": {
      "type": "object",
      "properties": {
        "grossAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "netAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "totalEarnings": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "totalDeductions": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "inpsTaxable": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "inpsContributions": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "irpefTaxable": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "irpefAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "regionalTax": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "municipalTax": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "tfrUsefulSalary": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "paymentDate": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": []
    },
    "d11": {
      "type": "object",
      "properties": {
        "schemaVersion": {
          "const": "fiscal-v1"
        },
        "period": {
          "anyOf": [
            {
              "ref": "d12"
            }
          ]
        },
        "socialSecurity": {
          "ref": "d13"
        },
        "incomeTax": {
          "ref": "d15"
        },
        "additionalTaxes": {
          "ref": "d16"
        },
        "tfr": {
          "ref": "d17"
        },
        "annualProgressives": {
          "ref": "d19"
        },
        "unclassifiedValues": {
          "type": "array",
          "items": {
            "ref": "d14"
          }
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "schemaVersion",
        "socialSecurity",
        "incomeTax",
        "additionalTaxes",
        "tfr",
        "annualProgressives",
        "unclassifiedValues",
        "warnings"
      ]
    },
    "d12": {
      "type": "object",
      "properties": {
        "month": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "year": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        }
      },
      "required": []
    },
    "d13": {
      "type": "object",
      "properties": {
        "monthlyTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "progressiveTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "employeeContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "employerContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "totalContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "contributionRate": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "days": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "weeks": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "hours": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "bilateralEmployeeContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "bilateralEmployerContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        }
      },
      "required": []
    },
    "d14": {
      "type": "object",
      "properties": {
        "field": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "valueKind": {
          "anyOf": [
            {
              "const": "percentage"
            },
            {
              "const": "money"
            },
            {
              "const": "fraction"
            },
            {
              "const": "integer"
            }
          ]
        },
        "unit": {
          "anyOf": [
            {
              "const": "EUR"
            },
            {
              "const": "PERCENT_POINTS"
            },
            {
              "const": "FRACTION"
            },
            {
              "const": "UNSPECIFIED"
            }
          ]
        },
        "source": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "fiscal_section"
            },
            {
              "const": "payroll_line"
            },
            {
              "const": "summary"
            },
            {
              "const": "progressive_section"
            },
            {
              "const": "derived"
            }
          ]
        },
        "period": {
          "anyOf": [
            {
              "const": "monthly"
            },
            {
              "const": "progressive"
            },
            {
              "const": "annual"
            },
            {
              "const": "previous_employment"
            },
            {
              "const": "adjustment"
            },
            {
              "const": "unknown_period"
            }
          ]
        },
        "confidence": {
          "type": "number"
        },
        "ambiguous": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "page": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "section": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "extractionMethod": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "payroll_line"
            },
            {
              "const": "derived"
            },
            {
              "const": "label_catalog"
            },
            {
              "const": "geometric_column"
            }
          ]
        },
        "alternatives": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        }
      },
      "required": [
        "source",
        "period",
        "confidence",
        "extractionMethod"
      ]
    },
    "d15": {
      "type": "object",
      "properties": {
        "deductionDays": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "monthlyTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "ordinaryMonthlyTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "supplementaryMonthlyTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "progressiveTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "grossTax": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "workDeductions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "familyDeductions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "additionalDeductions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "taxCredits": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "supplementaryTreatment": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "netTax": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "taxWithheld": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "ordinaryTaxWithheld": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "supplementaryTaxWithheld": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "totalTaxWithheld": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "taxAdjustment": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        }
      },
      "required": []
    },
    "d16": {
      "type": "object",
      "properties": {
        "regionalBalance": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "municipalBalance": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "municipalAdvance": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "other": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        }
      },
      "required": []
    },
    "d17": {
      "type": "object",
      "properties": {
        "monthlyAccrual": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "progressiveAccrual": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "taxableBase": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "revaluation": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "revaluationTax": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "destination": {
          "anyOf": [
            {
              "ref": "d18"
            }
          ]
        },
        "pensionFundContribution": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        }
      },
      "required": []
    },
    "d18": {
      "type": "object",
      "properties": {
        "field": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "valueKind": {
          "anyOf": [
            {
              "const": "percentage"
            },
            {
              "const": "money"
            },
            {
              "const": "fraction"
            },
            {
              "const": "integer"
            }
          ]
        },
        "unit": {
          "anyOf": [
            {
              "const": "EUR"
            },
            {
              "const": "PERCENT_POINTS"
            },
            {
              "const": "FRACTION"
            },
            {
              "const": "UNSPECIFIED"
            }
          ]
        },
        "source": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "fiscal_section"
            },
            {
              "const": "payroll_line"
            },
            {
              "const": "summary"
            },
            {
              "const": "progressive_section"
            },
            {
              "const": "derived"
            }
          ]
        },
        "period": {
          "anyOf": [
            {
              "const": "monthly"
            },
            {
              "const": "progressive"
            },
            {
              "const": "annual"
            },
            {
              "const": "previous_employment"
            },
            {
              "const": "adjustment"
            },
            {
              "const": "unknown_period"
            }
          ]
        },
        "confidence": {
          "type": "number"
        },
        "ambiguous": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "page": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "section": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "extractionMethod": {
          "anyOf": [
            {
              "const": "unknown"
            },
            {
              "const": "payroll_line"
            },
            {
              "const": "derived"
            },
            {
              "const": "label_catalog"
            },
            {
              "const": "geometric_column"
            }
          ]
        },
        "alternatives": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        }
      },
      "required": [
        "source",
        "period",
        "confidence",
        "extractionMethod"
      ]
    },
    "d19": {
      "type": "object",
      "properties": {
        "deductionDays": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "grossIncome": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "socialSecurityTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "incomeTaxTaxable": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "employeeContributions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "grossTax": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "deductions": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        },
        "netTax": {
          "anyOf": [
            {
              "ref": "d14"
            }
          ]
        }
      },
      "required": []
    },
    "d20": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "driverProfileId": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "year": {
          "type": "number"
        },
        "month": {
          "type": "number"
        },
        "createdAt": {
          "type": "string"
        },
        "inputSnapshot": {
          "ref": "d21"
        },
        "predictedLines": {
          "type": "array",
          "items": {
            "ref": "d9"
          }
        },
        "predictedSummary": {
          "anyOf": [
            {
              "ref": "d10"
            },
            {
              "ref": "d29"
            }
          ]
        },
        "confidence": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "missingData": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "id",
        "year",
        "month",
        "createdAt",
        "inputSnapshot",
        "predictedLines",
        "predictedSummary",
        "assumptions",
        "missingData"
      ]
    },
    "d21": {
      "type": "object",
      "properties": {
        "year": {
          "type": "number"
        },
        "month": {
          "type": "number"
        },
        "driverProfileId": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "attendanceEvents": {
          "type": "array",
          "items": {
            "ref": "d22"
          }
        },
        "workedDays": {
          "type": "number"
        },
        "eligibleTravelDays": {
          "type": "number"
        },
        "sundaysWorked": {
          "type": "number"
        },
        "holidaysWorked": {
          "type": "number"
        },
        "vacationDays": {
          "type": "number"
        },
        "parHours": {
          "type": "number"
        },
        "sicknessDays": {
          "type": "number"
        },
        "injuryDays": {
          "type": "number"
        },
        "strikeHours": {
          "type": "number"
        },
        "abortDays": {
          "type": "number"
        },
        "ordinaryHours": {
          "type": "number"
        },
        "effectiveHours": {
          "type": "number"
        },
        "theoreticalHours": {
          "type": "number"
        },
        "overtime30Hours": {
          "type": "number"
        },
        "overtime50Hours": {
          "type": "number"
        }
      },
      "required": [
        "year",
        "month",
        "attendanceEvents",
        "workedDays",
        "eligibleTravelDays",
        "sundaysWorked",
        "holidaysWorked",
        "vacationDays",
        "parHours",
        "sicknessDays",
        "injuryDays",
        "strikeHours",
        "abortDays",
        "ordinaryHours",
        "effectiveHours",
        "theoreticalHours",
        "overtime30Hours",
        "overtime50Hours"
      ]
    },
    "d22": {
      "type": "object",
      "properties": {
        "date": {
          "type": "string"
        },
        "status": {
          "anyOf": [
            {
              "const": "paid_leave"
            },
            {
              "const": "vacation"
            },
            {
              "const": "sickness"
            },
            {
              "const": "injury"
            },
            {
              "const": "strike"
            },
            {
              "const": "worked"
            },
            {
              "const": "rest"
            },
            {
              "const": "sunday_worked"
            },
            {
              "const": "holiday_worked"
            },
            {
              "const": "holiday_not_worked"
            },
            {
              "const": "par"
            },
            {
              "const": "ex_holiday"
            },
            {
              "const": "union_leave"
            },
            {
              "const": "unpaid_leave"
            },
            {
              "const": "abort"
            },
            {
              "const": "training"
            },
            {
              "const": "medical_visit"
            }
          ]
        },
        "hoursWorked": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "theoreticalHours": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "isSunday": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "isHoliday": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "isContractualDay": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "isWorkedHoliday": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "isAbort": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "isPaid": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "eligibleForTravelAllowance": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "shortWorkedDay": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "eligibleForSundayAllowance": {
          "anyOf": [
            {
              "const": false
            },
            {
              "const": true
            }
          ]
        },
        "overtimeHours30": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "overtimeHours50": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "notes": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": [
        "date",
        "status",
        "isSunday",
        "isHoliday",
        "isWorkedHoliday",
        "isAbort",
        "isPaid",
        "eligibleForTravelAllowance",
        "eligibleForSundayAllowance"
      ]
    },
    "d23": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "predictionId": {
          "type": "string"
        },
        "payslipImportId": {
          "type": "string"
        },
        "year": {
          "type": "number"
        },
        "month": {
          "type": "number"
        },
        "netDifference": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "grossDifference": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "lineDifferences": {
          "type": "array",
          "items": {
            "ref": "d24"
          }
        },
        "possibleCauses": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "modelUpdatesSuggested": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "accuracyPercent": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        }
      },
      "required": [
        "id",
        "predictionId",
        "payslipImportId",
        "year",
        "month",
        "lineDifferences",
        "possibleCauses",
        "modelUpdatesSuggested"
      ]
    },
    "d24": {
      "type": "object",
      "properties": {
        "code": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "label": {
          "type": "string"
        },
        "predictedAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "actualAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "difference": {
          "type": "number"
        },
        "possibleCause": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": [
        "label",
        "difference"
      ]
    },
    "d25": {
      "type": "object",
      "properties": {
        "driverProfileId": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "payrollProvider": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        },
        "knownAliases": {
          "ref": "d26"
        },
        "recurringDeductions": {
          "type": "array",
          "items": {
            "ref": "d9"
          }
        },
        "recurringEarnings": {
          "type": "array",
          "items": {
            "ref": "d9"
          }
        },
        "roundingPatterns": {
          "ref": "d27"
        },
        "usualPaymentDay": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "usualPayrollDelayDays": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "confidenceByRule": {
          "ref": "d27"
        },
        "lastUpdatedAt": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": [
        "knownAliases",
        "recurringDeductions",
        "recurringEarnings",
        "roundingPatterns",
        "confidenceByRule"
      ]
    },
    "d26": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "d27": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": {
        "type": "number"
      }
    },
    "d28": {
      "type": "object",
      "properties": {
        "contractType": {
          "anyOf": [
            {
              "const": "full_time"
            },
            {
              "const": "part_time"
            }
          ]
        },
        "weeklyHours": {
          "type": "number"
        },
        "contractualWeekdays": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "const": 1
              },
              {
                "const": 2
              },
              {
                "const": 3
              },
              {
                "const": 4
              },
              {
                "const": 5
              },
              {
                "const": 6
              },
              {
                "const": 7
              }
            ]
          }
        }
      },
      "required": [
        "contractType",
        "weeklyHours",
        "contractualWeekdays"
      ]
    },
    "d29": {
      "type": "object",
      "properties": {
        "workedRealDays": {
          "type": "number"
        },
        "paidOrdinaryDays": {
          "type": "number"
        },
        "eligibleTravelDays": {
          "type": "number"
        },
        "sundaysWorked": {
          "type": "number"
        },
        "holidaysWorked": {
          "type": "number"
        },
        "abortDays": {
          "type": "number"
        },
        "vacationDays": {
          "type": "number"
        },
        "parHours": {
          "type": "number"
        },
        "sicknessDays": {
          "type": "number"
        },
        "injuryDays": {
          "type": "number"
        },
        "manualEarnings": {
          "type": "number"
        },
        "manualDeductions": {
          "type": "number"
        },
        "grossAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "netAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "totalEarnings": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "totalDeductions": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "inpsTaxable": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "inpsContributions": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "irpefTaxable": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "irpefAmount": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "regionalTax": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "municipalTax": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "tfrUsefulSalary": {
          "anyOf": [
            {
              "type": "number"
            }
          ]
        },
        "paymentDate": {
          "anyOf": [
            {
              "type": "string"
            }
          ]
        }
      },
      "required": [
        "workedRealDays",
        "paidOrdinaryDays",
        "eligibleTravelDays",
        "sundaysWorked",
        "holidaysWorked",
        "abortDays",
        "vacationDays",
        "parHours",
        "sicknessDays",
        "injuryDays",
        "manualEarnings",
        "manualDeductions"
      ]
    }
  }
}
