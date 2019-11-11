# See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def _prepare_invoice(self):
        invoice_partner_id = False
        if self.partner_invoice_id:
            invoice_partner_id = self.partner_invoice_id.id
        else:
            invoice_partner_id = self.partner_id.id,
        return {
            'name': self.name,
            'origin': self.name,
            'account_id': self.partner_id.property_account_receivable_id.id,
            'journal_id': self.session_id.config_id.invoice_journal_id.id,
            'company_id': self.company_id.id,
            'type': 'out_invoice',
            'reference': self.name,
            'partner_id': invoice_partner_id,
            'comment': self.note or '',
            # considering partner's sale pricelist's currency
            'currency_id': self.pricelist_id.currency_id.id,
            'user_id': self.user_id.id,
        }

    partner_invoice_id = fields.Many2one(
        'res.partner', string='Invoice Address', copy=False)

    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res.update({
            'partner_invoice_id': ui_order.get('partner_invoice_links') or 0.0,
        })
        return res
