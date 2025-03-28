require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class FieldMappingAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.zoroFields = []; // This should be populated with your Zoro fields
    this.mappingRules = []; // Stores the mapping rules
  }

  /**
   * Load Zoro fields (could be from a file or hardcoded)
   */
  async loadZoroFields() {
    // This could be loaded from a file or database
    // For now, we'll use a hardcoded example
    this.zoroFields = [
        'supplierSku',
      'product_id',
      'product_name',
      'price',
      'quantity',
      'is_available',
      'total_value'
    ];
  }


  async loadSupplierFields() {
    return new Promise((resolve, reject) => {
      const fields = [
        "PRODUCTCODE", "STOCK", "EXPECTEDDATE", "stock no", "primary", "secondary", "tertiary", "cstock", "direct", 'isStocked'
      ];
      resolve(fields);
    });
  }

  /**
   * Generate mapping suggestions using OpenAI
   * @param {Array} zoroFields - Array of Zoro fields
   * @param {Array} supplierFields - Array of supplier fields
   * @returns {Promise<Object>} - Mapping suggestions
   */
  async generateMappingSuggestions(zoroFields, supplierFields) {
    const prompt = this.createMappingPrompt(zoroFields, supplierFields);
    
    const fullPrompt = true 
      ? `${prompt}\n\nAdditional User Instructions: is_available zoro field is boolean based on isStocked supplier field equals to 'YES'`
      : prompt;
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that helps map supplier fields to Zoro fields. " +
              "For each Zoro field, suggest either a direct mapping from supplier fields or " +
              "a formula that combines multiple supplier fields. " +
              "Respond with a JSON object containing the mapping rules."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error("Error generating mapping suggestions:", error);
      throw error;
    }
  }

  /**
   * Create the prompt for OpenAI
   * @param {Array} zoroFields - Array of Zoro fields
   * @param {Array} supplierFields - Array of supplier fields
   * @returns {string} - The constructed prompt
   */
  createMappingPrompt(zoroFields, supplierFields) {
    return `
      I need to map supplier fields to Zoro fields. Here are the details:

      Zoro Fields: ${zoroFields.join(', ')}

      Supplier Fields: ${supplierFields.join(', ')}

      For each Zoro field, please suggest either:
      1. A direct mapping to a single supplier field (if there's an obvious match)
       2. For formulas:
         - Use JavaScript syntax compatible with expr-eval
         - For conditionals, use ternary format: (condition) ? trueValue : falseValue
         - Compare strings with === and wrap in quotes: status === "YES"
         - Use standard math operators: +, -, *, /

      The formula can be:
      - Mathematical operations (e.g., "cost + tax = price")
      - Conditional mappings (e.g., "status == 'YES'")
      - String concatenations (e.g., "first_name + ' ' + last_name = full_name")

      Return your response as a JSON object with the following structure:
      {
        "mappings": [
          {
            "zoroField": "field_name",
            "direct": "supplier_field_name", // or empty string if using formula
            "formula": "" // or the formula if no direct mapping
          },
          ...
        ]
      }

      Provide the most logical mappings you can identify.
    `;
  }

  /**
   * Process all supplier files and generate mappings
   */
  async processAllSupplierFiles() {
    await this.loadZoroFields();
    try {
        const supplierFields = await this.loadSupplierFields();
        const mappings = await this.generateMappingSuggestions(this.zoroFields, supplierFields);
        
        // Store the mappings with the supplier file reference
        this.mappingRules.push({
          supplierFile: '',
          mappings: mappings.mappings
        });

        console.log(`Generated mappings`);
        console.log(JSON.stringify(mappings, null, 2));
      } catch (error) {
        console.error(`Error processing`, error);
      }
  }

  /**
   * Get the final mapping structure in the requested format
   * @returns {Array} - The mapping structure
   */
  getFinalMappingStructure() {
    return this.mappingRules.map(rule => {
      const formattedMappings = {};
      
      rule.mappings.forEach(mapping => {
        formattedMappings[mapping.zoroField] = {
          direct: mapping.direct || '',
          formula: mapping.formula || ''
        };
      });
      
      return formattedMappings;
    });
  }
}

// Example usage
(async () => {
  try {
    const agent = new FieldMappingAgent();
    
    await agent.processAllSupplierFiles();
    
    const finalMappings = agent.getFinalMappingStructure();
    console.log("Final Mappings:");
    console.log(JSON.stringify(finalMappings, null, 2));
  } catch (error) {
    console.error("Error in main execution:", error);
  }
})();