# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class PosProductTemplateParser(models.AbstractModel):
    _name = 'report.pos_product_template_view.report_template_docs'
    _description = "Template View"

    @api.model
    def _get_report_values(self, docids, data=None):
        product_template = self.env['product.product'].browse(docids)
        domain = [('state', '=', 'installed')]
        modules = self.env['ir.module.module'].search(domain)
        modules_list = modules.mapped("name")
        return {
            'doc_ids': docids,
            'doc_model': 'product.product',
            'data': data,
            'docs': product_template,
            'is_install': modules_list,
        }
