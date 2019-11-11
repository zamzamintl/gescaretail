# See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class ResCompany(models.Model):
    _inherit = 'res.company'

    loyalty_percentage = fields.Float("Loyalty Percentage")


class ResPartner(models.Model):
    _inherit = 'res.partner'

    loyalty_amounts = fields.Float('Loyalty Amounts')


class AccountJournal(models.Model):
    _inherit = "account.journal"

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        if self._context.get('pos_journal'):
            if self._context.get('journal_ids') and \
               self._context.get('journal_ids')[0] and \
               self._context.get('journal_ids')[0][2]:
                args += [['id', 'in', self._context.get('journal_ids')[0][2]]]
            else:
                return False
        return super(
            AccountJournal,
            self).name_search(
            name,
            args=args,
            operator=operator,
            limit=limit)

    is_loyalty_journal = fields.Boolean('Use for Loyalty', default=False)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_loyalty = fields.Boolean('Enable Loyalty')
    loyalty_journal = fields.Many2one(
        'account.journal',
        'Loyalty Journal',
        help="To use Loyalty Functionality \
        need to define journal for Loyalty.")


class PosOrder(models.Model):
    _inherit = 'pos.order'

    won_loyalty_amounts = fields.Float('Won Amounts')
    redeem_loyalty_amount = fields.Float('Redeem Amounts')

    def _order_fields(self, ui_order):
        fields = super(PosOrder, self)._order_fields(ui_order)
        currency = self.env.user.company_id.currency_id
        fields['won_loyalty_amounts'] = currency.round(ui_order.get(
            'won_loyalty_amounts', 0))
        fields['redeem_loyalty_amount'] = currency.round(ui_order.get(
            'redeem_loyalty_amount', 0))
        return fields

    @api.model
    def create_from_ui(self, orders):
        res = super(PosOrder, self).create_from_ui(orders)
        currency = self.env.user.company_id.currency_id
        for order_id in res:
            order = self.browse(order_id)
            if order:
                partner = order.partner_id
                if partner:
                    if order.state == 'paid' or order.state == 'invoiced':
                        if order.won_loyalty_amounts != 0:
                            partner.loyalty_amounts = currency.round(
                                partner.loyalty_amounts +
                                order.won_loyalty_amounts)
                    if order.redeem_loyalty_amount != 0:
                        partner.loyalty_amounts = currency.round(
                            partner.loyalty_amounts -
                            order.redeem_loyalty_amount)
                    if partner.loyalty_amounts < 0:
                        partner.loyalty_amounts = 0
        return res


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    ignor_for_loyalty = fields.Boolean("No Loyalty")
