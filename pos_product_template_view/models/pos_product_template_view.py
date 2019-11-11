# See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _
import logging

_logger = logging.getLogger(__name__)


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_view = fields.Html(
        string='Product View',
        compute="_get_product_view",
    )

    @api.model
    def pos_get_product_view(self, id):
        for record in self.browse(id):
            try:
                data = {}
                data['context'] = self._context
                report = self.env[
                    'ir.actions.report'].sudo()._get_report_from_name(
                        'pos_product_template_view.\
report_template_docs')
                html = report.render_qweb_html(
                    record.id,
                    data=data
                )
            except ValueError:
                _logger.exception(
                    'Failed to render product view for product id %s' %
                    record.id
                )
                html = _("<p>Failed to retrieve stock info</p>")
        return html[0]

    @api.model
    def _get_product_view(self):
        for record in self:
            try:
                data = {}
                data['context'] = self._context
                report = self.env[
                    'ir.actions.report'].sudo()._get_report_from_name(
                        'pos_product_template_view.\
report_template_docs')
                html = report.render_qweb_html(
                    record.id,
                    data=data
                )
            except ValueError:
                _logger.exception(
                    'Failed to render product view for product id %s' %
                    record.id
                )
                html = _("<p>Failed to retrieve stock info</p>")
            record.product_view = html

        return html[0]
