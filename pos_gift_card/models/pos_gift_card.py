# See LICENSE file for full copyright and licensing details.

import time

from odoo import api, fields, models


class PosGiftCard(models.Model):
    _name = 'pos.gift.card'
    _rec_name = 'card_no'

    def random_cardno(self):
        return int(time.time())

    card_no = fields.Char(
        string="Card No",
        default=random_cardno,
        readonly=True,
        copy=False)
    card_value = fields.Float(string="Card Value")
    customer_id = fields.Many2one(
        'res.partner',
        string="Customer")
    issue_date = fields.Date(
        string="Issue Date",
        default=fields.Date.context_today)
    expire_date = fields.Date(string="Expire Date")
    is_active = fields.Boolean('Active', default=True)
    used_line = fields.One2many(
        'pos.gift.card.use',
        'card_id',
        string="Used Line")


class PosGiftCardUse(models.Model):
    _name = 'pos.gift.card.use'
    _rec_name = 'order_name'

    card_id = fields.Many2one('pos.gift.card', string="Card", readonly=True)
    customer_id = fields.Many2one('res.partner', string="Customer")
    order_name = fields.Char(string="Order Name")
    order_date = fields.Date(string="Order Date")
    amount = fields.Float(string="amount")


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.multi
    @api.depends('used_ids')
    def compute_amount(self):
        total_used_amount = 0
        for ids in self:
            for used_id in ids.used_ids:
                total_used_amount += used_id.amount
            ids.remaining_amount = total_used_amount

    card_ids = fields.One2many(
        'pos.gift.card',
        'customer_id',
        string="List of card")
    used_ids = fields.One2many(
        'pos.gift.card.use',
        'customer_id',
        string="List of used card")
    remaining_amount = fields.Char(
        compute=compute_amount,
        string="Remaining Amount",
        readonly=True)


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

    pos_front_display = fields.Boolean('Display in POS Front', default=True)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_gift_card = fields.Boolean('Enable Gift Card')
    gift_card_product_id = fields.Many2one(
        'product.product', string="Gift Card Product")
    enable_journal_id = fields.Many2one(
        'account.journal', string="Gift Card Journal")


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def create_from_ui(self, orders):
        order_dict = {o['data']['pos_reference']: o for o in orders}
        pos_order = super(PosOrder, self).create_from_ui(orders)
        for tmp_order in self.browse(pos_order):
            order_exists = order_dict.get(tmp_order.pos_reference)
            order = order_exists['data']
            currency = tmp_order.company_id.currency_id
            if order.get('giftcard'):
                for create_details in order.get('giftcard', False):
                    if create_details:
                        customer_id = create_details.get('giftcard_customer')
                        if not customer_id:
                            if tmp_order.partner_id:
                                customer_id = tmp_order.partner_id.id
                        card_value = currency.round(
                            float(create_details.get('giftcard_amount', 0)))
                        vals = {
                            'card_no': create_details.get('giftcard_card_no'),
                            'card_value': card_value,
                            'customer_id': customer_id,
                            'issue_date': create_details.get(
                                'giftcard_issue_date'),
                            'expire_date': create_details.get(
                                'giftcard_expire_date'),
                        }
                        self.env['pos.gift.card'].create(vals)
            #  create redeem giftcard for use
            if order.get('redeem'):
                for redeem_details in order.get('redeem', False):
                    if redeem_details:
                        r_amount = currency.round(
                            float(redeem_details.get('redeem_card_amount', 0)))
                        redeem_vals = {
                            'order_name': tmp_order.name,
                            'order_date': tmp_order.date_order,
                            'customer_id':
                            redeem_details.get('card_customer_id') or False,
                            'card_id': redeem_details.get('redeem_card_no'),
                            'amount': r_amount,
                        }
                        use_giftcard = self.env['pos.gift.card.use'].create(
                            redeem_vals)
                        if use_giftcard:
                            use_giftcard.card_id.write(
                                {'card_value': currency.round(
                                 use_giftcard.card_id.card_value -
                                 use_giftcard.amount)})
        return pos_order

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
