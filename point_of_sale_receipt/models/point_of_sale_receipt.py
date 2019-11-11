# See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from datetime import timedelta
import pytz


class PosConfig(models.Model):
    _inherit = 'pos.config'

    shop_address_id = fields.Many2one(
        comodel_name='res.partner',
        string='Shop address',
        required=1,
    )
    shop_name = fields.Char(
        related='shop_address_id.name',
        readonly=True
    )
    shop_street = fields.Char(
        related='shop_address_id.street',
        readonly=True
    )
    shop_street2 = fields.Char(
        related='shop_address_id.street2',
        readonly=True
    )
    shop_city = fields.Char(
        related='shop_address_id.city',
        readonly=True
    )
    shop_zip = fields.Char(
        related='shop_address_id.zip',
        readonly=True
    )
    shop_logo = fields.Binary(
        related='shop_address_id.image',
        readonly=True
    )
    shop_phone = fields.Char(
        related='shop_address_id.phone',
        readonly=True
    )
    shop_email = fields.Char(
        related='shop_address_id.email',
        readonly=True
    )


class PosOrder(models.Model):
    _inherit = 'pos.order'

    shop_id = fields.Many2one(
        related='session_id.config_id.shop_address_id',
        string="Shop",
        readonly=True,
        store=True
    )


class ResPartner(models.Model):
    _inherit = 'res.partner'

    ticket_name = fields.Char('POS Name')


class ReportSaleDetails(models.AbstractModel):

    _inherit = 'report.point_of_sale.report_saledetails'

    @api.model
    def get_current_session_sale_details(self, session_id):
        sessions = self.env['pos.session'].browse(session_id)
        return self.get_session_sale_details(False, False, sessions)

    @api.model
    def get_session_sale_details(
            self, date_start=False, date_stop=False, sessions=False):
        """
        Serialise the orders of the day information.

        params:
        date_start, date_stop string representing the datetime of order.
        """
        if not sessions:
            sessions = self.env['pos.session'].search([])

        user_tz = pytz.timezone(
            self.env.context.get('tz') or self.env.user.tz or 'UTC')
        today = user_tz.localize(
            fields.Datetime.from_string(fields.Date.context_today(self)))
        today = today.astimezone(pytz.timezone('UTC'))
        if date_start:
            date_start = fields.Datetime.from_string(date_start)
        else:
            # start by default today 00:00:00
            date_start = today

        if date_stop:
            # set time to 23:59:59
            date_stop = fields.Datetime.from_string(date_stop)
        else:
            # stop by default today 23:59:59
            date_stop = today + timedelta(days=1, seconds=-1)

        # avoid a date_stop smaller than date_start
        date_stop = max(date_stop, date_start)

        date_start = fields.Datetime.to_string(date_start)
        date_stop = fields.Datetime.to_string(date_stop)

        orders = self.env['pos.order'].search([
            ('date_order', '>=', date_start),
            ('date_order', '<=', date_stop),
            ('state', 'in', ['paid', 'invoiced', 'done']),
            ('session_id', 'in', sessions.ids)])

        user_currency = self.env.user.company_id.currency_id

        total = 0.0
        products_sold = {}
        taxes = {}
        for order in orders:
            if user_currency != order.pricelist_id.currency_id:
                total += order.pricelist_id.currency_id.compute(
                    order.amount_total,
                    user_currency)
            else:
                total += order.amount_total
            currency = order.session_id.currency_id

            for line in order.lines:
                key = (line.product_id, line.price_unit, line.discount)
                products_sold.setdefault(key, 0.0)
                products_sold[key] += line.qty

                if line.tax_ids_after_fiscal_position:
                    line_taxes = \
                        line.tax_ids_after_fiscal_position.compute_all(
                            line.price_unit * (1 - (
                                line.discount or 0.0) / 100.0),
                            currency, line.qty, product=line.product_id,
                            partner=line.order_id.partner_id or False)
                    for tax in line_taxes['taxes']:
                        taxes.setdefault(tax['id'], {
                            'name': tax['name'],
                            'tax_amount': 0.0, 'base_amount': 0.0})
                        taxes[tax['id']]['tax_amount'] += tax['amount']
                        taxes[tax['id']]['base_amount'] += tax['base']
                else:
                    taxes.setdefault(
                        0, {
                            'name': _('No Taxes'),
                            'tax_amount': 0.0,
                            'base_amount': 0.0})
                    taxes[0]['base_amount'] += line.price_subtotal_incl

        st_line_ids = self.env["account.bank.statement.line"].search(
            [('pos_statement_id', 'in', orders.ids)]).ids
        if st_line_ids:
            self.env.cr.execute("""
                SELECT aj.name, sum(amount) total
                FROM account_bank_statement_line AS absl,
                     account_bank_statement AS abs,
                     account_journal AS aj
                WHERE absl.statement_id = abs.id
                    AND abs.journal_id = aj.id
                    AND absl.id IN %s
                GROUP BY aj.name
            """, (tuple(st_line_ids),))
            payments = self.env.cr.dictfetchall()
        else:
            payments = []

        return {
            'currency_precision': user_currency.decimal_places,
            'total_paid': user_currency.round(total),
            'payments': payments,
            'company_name': self.env.user.company_id.name,
            'taxes': list(taxes.values()),
            'products': sorted([{
                'product_id': product.id,
                'product_name': product.name,
                'code': product.default_code,
                'quantity': qty,
                'price_unit': price_unit,
                'discount': discount,
                'uom': product.uom_id.name
            } for (product, price_unit, discount),
                qty in products_sold.items()], key=lambda l: l['product_name'])
        }


class AccountJournal(models.Model):
    _inherit = "account.journal"

    print_journal_name = fields.Char(
        string='Print Journal Name',
    )


class AccountBankStatmentLine(models.Model):
    _inherit = 'account.bank.statement.line'

    print_journal_name = fields.Char(
        related="journal_id.print_journal_name",
        string='Print Journal Name',
    )
