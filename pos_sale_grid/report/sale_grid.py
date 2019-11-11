# See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models


class SaleGridReport(models.Model):
    _name = "sale.grid.report"
    _description = "Sales Grid Orders Statistics"
    _order = 'sequence asc'
    _auto = False

    color_attribute = fields.Many2one('product.attribute.value',
                                      string='color',
                                      domain="[('attribute_type','=','color')]"
                                      )
    size_attribute = fields.Many2one('product.attribute.value', string='Size',
                                     domain="[('attribute_type','=','size')]")
    sequence = fields.Integer()
    location = fields.Char(string='Location')
    product_id = fields.Many2one('product.product')
    product_tmpl_id = fields.Many2one('product.template')
    qty_sold = fields.Integer()

    def _qry(self):
        qry = """
(SELECT -min(product.id)                   as id,
        product.product_tmpl_id            as product_tmpl_id,
        product.color_attribute_id         as color_attribute,
        product.size_attribute_id          as size_attribute,
        sum(coalesce(sline.product_uom_qty, null)) as qty_sold,
        product.id                         as product_id,
        crm_team.sequence 				   as sequence,
        coalesce(crm_team.name,
                 (SELECT name as team_name FROM crm_team limit 1))
                                           as location
 FROM product_product as product
        left join sale_order_line as sline on sline.product_id = product.id
        left join sale_order as sorder on sline.order_id = sorder.id
        left join crm_team on sorder.team_id = crm_team.id
 WHERE sorder.state in ('sale','done')
 GROUP BY product_tmpl_id,
          product.color_attribute_id,
          product.size_attribute_id,
          product.id,
          crm_team.sequence,
          crm_team.name)
UNION
(SELECT min(product.id)                         as id,
            product.product_tmpl_id             as product_tmpl_id,
            product.color_attribute_id          as color_attribute,
            product.size_attribute_id           as size_attribute,
            sum(coalesce(poline.qty, null))     as qty_sold,
            product.id                          as product_id,
            res_partner.cash_register_sequence  as sequence,
            coalesce(res_partner.name,
                     (SELECT name
                      FROM res_partner
                      WHERE parent_id = 1
                      limit 1))
                                       as location
     FROM product_product as product
            left join pos_order_line as poline
              on poline.product_id = product.id
            left join pos_order on poline.order_id = pos_order.id
            left join pos_session on pos_order.session_id = pos_session.id
            left join pos_config on pos_session.config_id = pos_config.id
            left join res_partner
              on pos_config.shop_address_id = res_partner.id
     where res_partner.parent_id = 1 AND pos_order.state != 'cancel'
     GROUP BY product_tmpl_id,
              product.color_attribute_id,
              product.size_attribute_id,
              product.id,
              res_partner.cash_register_sequence,
              location)
        """
        return qry

    @api.model_cr
    def init(self):
        # self._table = sale_report
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (
            %s
            )""" % (
            self._table, self._qry()))
