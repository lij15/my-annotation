const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
    async init(){
        const {Products} = this.entities
        // after READ: Populate the calculated field priceWithTax
        this.after('READ',Products,products => {
            if(!products) return

            const list = Array.isArray(products) ? products : [products]
            const TAX_RATE = 0.1

            for(const p of list) {
                if(p.price != null) {
                    p.priceWithTax = +(p.price * (1 + TAX_RATE)).toFixed(2)
                }
            }
        })

        // before CREATE: Demonstrates @mandatory automatic validation
        // If title/price/sku is empty, CAP will have already returned 400 before this before statement.
        // Reaching this point indicates that all required fields already have values
        this.before('CREATE',Products,req => {
            console.log('Required field validation passed, req.data:',req.data)
            console.log('Note: Even if the client sends a rating, it will not be visible here (@readonly has been ignored).')

            if(req.data.price <= 0){
                return req.error(400,'The price must be greater than 0.')
            }

            if(!req.data.sku.startsWith('SKU-')) {
                return req.error(400,'The SKU format is incorrect; it must begin with SKU-.')
            }
        })

        this.before('UPDATE',Products,req => {
            console.log('PATCH payload (@readonly field has been filtered):',req.data)
        })

        return super.init()
    }
}