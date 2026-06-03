namespace my.annotations;

using {cuid,managed} from '@sap/cds/common';

entity Products : cuid,managed {
    title       :       String(200);
    description :       String(1000);
    price       :       Decimal(9,2);
    stock       :       Integer default 0;
    sku         :       String(50);
    category    :       String(100);
    rating      :       Decimal(3,2) default 0;
}