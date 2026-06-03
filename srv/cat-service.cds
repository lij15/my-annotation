using { my.annotations as db } from '../db/schema';

service CatalogService {

    @title: 'Product Catalog'
    entity Products as projection on db.Products {
        *,
        null as priceWithTax : Decimal(9, 2) //Declare virtual fields
    }

}

annotate CatalogService.Products with {
    ID          @readonly;
    createdAt   @readonly;
    modifiedAt  @readonly;
    rating      @readonly;

    title       @mandatory @title : 'Product Name';
    price       @mandatory @title : 'Unit Price' @assert.range:[0.01,99999.99];
    sku         @assert.format : 'SKU-[A-Z0-9]{3,10}' @mandatory @title : 'SKU' @description : 'Unique product identifier for inventory tracking';

    stock       @title : 'Stock Quantity' @assert.range:[0,9999];
    description @UI.MultiLineText;
    // @Core.Computed: A marker for computed fields
    // Informs the client that this field is computed by the server
    priceWithTax  @Core.Computed @readonly;
}
