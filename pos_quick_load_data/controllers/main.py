# See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class PosProductController(http.Controller):

    @http.route('/web/product_load', type="json", auth="user")
    def get_pos_product(self, **kw):
        is_pos_discount_management = kw.get('is_pos_discount_management')
        is_pos_loyalty_amount_install = kw.get('is_pos_loyalty_amount_install')
        # is_pos_stock_grid_install = kw.get('is_pos_stock_grid_install')
        is_product_brand_install = kw.get('is_product_brand_install')
        is_product_gender_install = kw.get('is_product_gender_install')
        is_product_collections_install = kw.get(
            'is_product_collections_install')
        is_product_attribute_type_install = kw.get(
            'is_product_attribute_type_install')
        is_product_variant_prices_install = kw.get(
            'is_product_variant_prices_install')
        # is_pos_product_list_view_install = kw.get(
        #     'is_pos_product_list_view_install')
        query_str = """select pp.barcode as barcode,
                     pp.id as id,
                     pp.default_code as default_code,
                     pt.description as description,
                     pt.description_sale as description_sale,
                     pt.name as name,
                     pt.type as type,"""
        if is_product_variant_prices_install:
            query_str = query_str + """
                  pp.lst_price as list_price,
                  pp.lst_price as standard_price,
                  pp.lst_price as lst_price,
                  pp.lst_price as price,"""
        else:
            query_str = query_str + """
                (SUM(case when
                 pap.price_extra is not null
                 then pap.price_extra else 0 end)
                 + pt.list_price) as list_price,
                 (SUM(case when
                 pap.price_extra is not null then
                 pap.price_extra else 0 end) +
                 pt.list_price) as standard_price,
                 (SUM(case when pap.price_extra is not null
                 then pap.price_extra else 0 end)
                 + pt.list_price) as lst_price,
                 (SUM(case when
                 pap.price_extra is not null
                 then pap.price_extra else 0 end)
                 + pt.list_price) as price,
            """
        query_str = query_str + """
                     pt.to_weight as to_weight,
                     pt.tracking as tracking,
                     string_to_array(pt.categ_id || ',' || (
                     select name from product_category where id = pt.categ_id),
                    ',') as categ_id,
                     string_to_array(pt.uom_id || ',' || (
                     select name from uom_uom where id = pt.uom_id), ',')
                     as uom_id,
                     string_to_array(pt.pos_categ_id || ',' || (
                     select name from pos_category where id = pt.pos_categ_id),
                      ',') as pos_categ_id,
                     array((
                     select tax_id from product_taxes_rel where
                     prod_id = pp.product_tmpl_id)) as taxes_id,
                     case when (
                     select count(*) from
                     product_attribute_value_product_product_rel
                     where product_product_id = pp.id) < 1
                     then CONCAT((
                     Select name from product_template where
                     id = pp.product_tmpl_id))
                     else
                     CONCAT( (Select name from product_template where
                     id = pp.product_tmpl_id),
                      '(' ,array_to_string(array(select name from
                      product_attribute_value where id in
                      (select product_attribute_value_id from
                      product_attribute_value_product_product_rel
                          where product_product_id=pp.id)), ','), ')')
                     end as display_name,
                     string_to_array(pp.product_tmpl_id || ',' || (
                     select name from product_template where
                     id = pp.product_tmpl_id), ',') as product_tmpl_id"""
        if is_pos_loyalty_amount_install:
            query_str = query_str + """,pt.ignor_for_loyalty as
                                         ignor_for_loyalty"""
        if is_pos_discount_management:
            query_str = query_str + """,pt.pos_no_discount_allowed as
                                         pos_no_discount_allowed"""
#        if is_pos_product_list_view_install:
#            query_str = query_str + """
#                 ,pt.model_default_code,
#                 pt.model_variant_code
#            """
        # if is_pos_stock_grid_install or is_pos_product_list_view_install:
        if is_product_brand_install:
            query_str = \
                query_str + """,string_to_array(pt.product_brand_id || ',' || (
                     select name from product_brand where id =
                     pt.product_brand_id),
                     ',') as product_brand_id """
        # if is_pos_product_list_view_install:
        if is_product_collections_install:
            query_str = query_str + """
            ,string_to_array(pt.collection_id || ',' || (
            select name from product_collection
            where id = pt.collection_id),
            ',') as collection_id"""
        # if is_pos_product_list_view_install:
        if is_product_gender_install:
            query_str = query_str + """, pt.gender"""
        # if is_pos_product_list_view_install
        if is_product_attribute_type_install:
            query_str = query_str + """,pp.color_attribute, pp.size_attribute,
            string_to_array(pp.color_attribute_id || ',' || (
            select name from product_attribute_value
            where id = pp.color_attribute_id),
            ',') as color_attribute_id,
            string_to_array(pp.size_attribute_id || ',' || (
            select name from product_attribute_value
            where id = pp.size_attribute_id),
            ',') as size_attribute_id
        """
        query_str += """ from product_template pt inner join product_product pp
                     ON(pp.product_tmpl_id=pt.id)
                     left join product_attribute_value_product_product_rel as
                     pp_rel
                     on (pp_rel.product_product_id = pp.id)
                     left join product_template_attribute_value pap on
                     (pp.product_tmpl_id = pap.product_tmpl_id and
                     pap.product_attribute_value_id =
                     pp_rel.product_attribute_value_id)
                     where pt.active=True AND pp.active=True AND
                     pt.sale_ok=True AND pt.available_in_pos=True"""
        query_str = query_str + """
                Group by pp.id,
                pt.sequence,pp.barcode
                ,pt.description,pt.description_sale,
                pt.type,pt.name,pt.list_price,pt.to_weight,
                pt.tracking,pt.categ_id,
                pt.uom_id,pt.pos_categ_id
        """
#        if is_pos_product_list_view_install:
#            query_str = query_str + """
#                 ,pt.model_default_code,
#                 pt.model_variant_code
#            """
        if is_pos_loyalty_amount_install:
            query_str = query_str + """,pt.ignor_for_loyalty"""
        if is_pos_discount_management:
            query_str = query_str + """,pt.pos_no_discount_allowed"""
        # if is_pos_stock_grid_install or is_pos_product_list_view_install:
        if is_product_brand_install:
            query_str = query_str + """,pt.product_brand_id"""
        if is_product_collections_install:
            query_str = query_str + """,pt.collection_id"""
        if is_product_gender_install:
            query_str = query_str + """,pt.gender"""
        if is_product_attribute_type_install:
            query_str = query_str + """,pp.color_attribute,
            pp.size_attribute, pp.color_attribute_id,
            pp.size_attribute_id
            """
        query_str = query_str + """ ORDER BY
                     pt.name,pt.sequence ASC """
        request.env.cr.execute(query_str)
        product_dicts = request.env.cr.dictfetchall()
        return product_dicts


class PosPartnerController(http.Controller):

    @http.route('/web/partner_load', type="json", auth="user")
    def get_pos_partner(self, **kw):
        pos_fixed_discount = kw.get('pos_fixed_discount')
        is_pos_loyalty_amount_install = kw.get('is_pos_loyalty_amount_install')
        pos_invoice_client = kw.get('is_pos_invoice_client')
        query_str = """
                    select rp.id,rp.write_date ,rp.street,rp.barcode,rp.city,
                    rp.name,rp.email,rp.mobile,rp.vat,rp.zip,rp.ref, rp.phone,
                    string_to_array(rp.property_product_pricelist || ',' || (
                     select name from product_pricelist where id =
                     rp.property_product_pricelist),
                     ',') as property_product_pricelist,
                    string_to_array(rp.state_id || ',' || (
                     select name from res_country_state where id =
                     rp.state_id),
                     ',') as state_id,
                    string_to_array(rp.country_id || ',' || (
                     select name from res_country where id = rp.country_id),
                     ',') as country_id,
                     string_to_array(rp.parent_id || ',' || (
                     select name from res_partner where id = rp.parent_id),
                     ',') as parent_id,
                    (select name from
                    res_partner where id = rp.parent_id )
                    as parent_name, rp.id,rp.write_date"""
        if pos_invoice_client:
            query_str += """,
                    string_to_array(rp.pos_invoice_partner || ',' || (
                    select name from res_partner
                    where id = rp.pos_invoice_partner),
                    ',') as pos_invoice_partner,
                    rp.type as type"""
        if pos_fixed_discount:
            query_str = query_str + """,rp.pos_fixed_discount"""
        if is_pos_loyalty_amount_install:
            query_str = query_str + """,rp.loyalty_amounts"""
        if not(kw.get('date')):
            query_str = query_str + """ from res_partner rp where active=True
                AND customer=True ORDER BY rp.name ASC"""
            request.env.cr.execute(query_str)
        else:
            query_str = query_str + """  from res_partner rp where active=True
                AND customer=True AND
                rp.write_date > %s ORDER BY rp.name ASC"""
            request.env.cr.execute(query_str, (kw.get('date'),))
        res_partner_dict = request.env.cr.dictfetchall()
        return res_partner_dict
