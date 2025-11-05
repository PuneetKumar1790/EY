const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tender Eligibility Analyzer API',
      version: '1.0.0',
      description: 'A comprehensive Node.js backend API that automates tender eligibility analysis using Google Gemini 2.5 Flash AI. The system processes multiple tender PDFs, analyzes company eligibility, performs SKU matching, calculates pricing, and sends automated email notifications with detailed reports.',
      contact: {
        name: 'API Support',
        email: 'puneetk49081@gmail.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Tender Management',
        description: 'Endpoints for uploading and processing tender documents'
      },
      {
        name: 'Company Management',
        description: 'Endpoints for uploading company information'
      },
      {
        name: 'Analysis',
        description: 'Endpoints for analyzing tender eligibility'
      },
      {
        name: 'Eligibility',
        description: 'Endpoints for checking eligibility and processing tenders'
      },
      {
        name: 'Workflow',
        description: 'Endpoints for automated workflows'
      },
      {
        name: 'Testing',
        description: 'Testing and utility endpoints'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message description'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            }
          }
        },
        TenderUploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Successfully processed 5 PDFs for tender1'
            },
            tenderId: {
              type: 'string',
              example: 'tender1'
            },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: {
                    type: 'string',
                    example: 'document1.pdf'
                  },
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  summaryPath: {
                    type: 'string',
                    example: 'summaries/tender1/1234567890_document1_summary.txt'
                  },
                  summaryLength: {
                    type: 'number',
                    example: 15234
                  },
                  textLength: {
                    type: 'number',
                    example: 45678
                  },
                  error: {
                    type: 'string',
                    example: 'No extractable text in PDF'
                  }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                total: {
                  type: 'number',
                  example: 5
                },
                successful: {
                  type: 'number',
                  example: 5
                },
                failed: {
                  type: 'number',
                  example: 0
                }
              }
            }
          }
        },
        CompanyUploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Company information uploaded successfully'
            },
            file: {
              type: 'string',
              example: 'company_info.docx'
            },
            textPath: {
              type: 'string',
              example: 'uploads/company-info.txt'
            },
            textLength: {
              type: 'number',
              example: 8921
            }
          }
        },
        AnalysisResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Eligibility analysis completed for tender1'
            },
            tenderId: {
              type: 'string',
              example: 'tender1'
            },
            tablePath: {
              type: 'string',
              example: 'analysis/tender1/table.txt'
            },
            combinedSummaryPath: {
              type: 'string',
              example: 'summaries/tender1/combined_summary.txt'
            },
            summary: {
              type: 'object',
              properties: {
                totalSummaries: {
                  type: 'number',
                  example: 5
                },
                comprehensiveSummaryLength: {
                  type: 'number',
                  example: 15234
                },
                companyInfoLength: {
                  type: 'number',
                  example: 8921
                },
                eligibilityTableLength: {
                  type: 'number',
                  example: 3456
                }
              }
            }
          }
        },
        EligibilityCheckResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Company is NOT eligible for tender1'
            },
            tenderId: {
              type: 'string',
              example: 'tender1'
            },
            eligible: {
              type: 'boolean',
              example: false
            },
            decision: {
              type: 'string',
              enum: ['YES', 'NO'],
              example: 'NO'
            },
            emailSent: {
              type: 'boolean',
              example: true
            },
            docxPath: {
              type: 'string',
              example: 'analysis/tender1/eligibility_report.docx'
            },
            usedFallback: {
              type: 'boolean',
              example: false
            },
            eligibilityTable: {
              type: 'string',
              example: 'Truncated preview of eligibility table...'
            }
          }
        },
        ProcessAllResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'All tenders processed'
            },
            summary: {
              type: 'object',
              properties: {
                eligible: {
                  type: 'number',
                  example: 0
                },
                notEligible: {
                  type: 'number',
                  example: 2
                },
                total: {
                  type: 'number',
                  example: 2
                }
              }
            },
            results: {
              type: 'object',
              properties: {
                tender1: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    eligible: {
                      type: 'boolean',
                      example: false
                    },
                    decision: {
                      type: 'string',
                      example: 'NO'
                    },
                    emailSent: {
                      type: 'boolean',
                      example: true
                    }
                  }
                },
                tender2: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    eligible: {
                      type: 'boolean',
                      example: false
                    },
                    decision: {
                      type: 'string',
                      example: 'NO'
                    },
                    emailSent: {
                      type: 'boolean',
                      example: true
                    }
                  }
                }
              }
            }
          }
        },
        Tender2WorkflowResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Tender 2 workflow completed successfully'
            },
            eligibility: {
              type: 'string',
              enum: ['YES', 'NO'],
              example: 'YES'
            },
            emailSent: {
              type: 'boolean',
              example: true
            },
            workflowDir: {
              type: 'string',
              example: 'workflows/tender2'
            },
            outputs: {
              type: 'object',
              properties: {
                summary1: {
                  type: 'string',
                  example: 'workflows/tender2/summary_1.txt'
                },
                summary2: {
                  type: 'string',
                  example: 'workflows/tender2/summary_2.txt'
                },
                combinedSummary: {
                  type: 'string',
                  example: 'workflows/tender2/combined_summary.txt'
                },
                comprehensiveSummary: {
                  type: 'string',
                  example: 'workflows/tender2/comprehensive_summary.txt'
                },
                eligibilityResult: {
                  type: 'string',
                  example: 'workflows/tender2/eligibility_result.txt'
                },
                tableB1: {
                  type: 'string',
                  example: 'workflows/tender2/table_b1.csv'
                },
                matchedSKUs: {
                  type: 'string',
                  example: 'workflows/tender2/matched_skus.txt'
                },
                pricingTable: {
                  type: 'string',
                  example: 'workflows/tender2/pricing_table.csv'
                },
                holisticSummaryTable: {
                  type: 'string',
                  example: 'workflows/tender2/holistic_summary_table.csv'
                }
              }
            },
            docxPath: {
              type: 'string',
              example: 'analysis/tender2/eligibility_report.docx'
            }
          }
        },
        GeminiTestResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            model: {
              type: 'string',
              example: 'gemini-2.5-flash'
            },
            response: {
              type: 'string',
              example: 'Hello, Gemini API is working!'
            },
            length: {
              type: 'number',
              example: 32
            }
          }
        }
      }
    }
  },
  apis: [
    './src/routes/*.js',
    './server.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

