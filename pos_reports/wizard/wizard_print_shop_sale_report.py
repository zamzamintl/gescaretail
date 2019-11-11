# -*- coding: utf-8 -*-

import logging
from datetime import datetime, timedelta

from odoo import fields, models, api, exceptions, _
from odoo.addons import decimal_precision as dp

_logger = logging.getLogger(__name__)


class WizardPrintShopReportLocation(models.TransientModel):
    _name = 'wizard.print.shop.sale.report.location'
    wizard_id = fields.Many2one(
        comodel_name='wizard.print.shop.sale.report',
        string='Location',
    )
    shop_address_id = fields.Many2one(
        comodel_name='res.partner',
        string='Shop address',
    )
    order_line_ids = fields.Many2many(
        comodel_name='pos.order.line',
        string='Orders'
    )
    total_sold = fields.Float(
        string='Total Sold',
        digits=dp.get_precision('Product Unit of Measure'),
    )
    total_main_stock = fields.Float(
        string='Total main stock',
        digits=dp.get_precision('Product Unit of Measure'),
    )
    total_qty_left_on_location = fields.Float(
        string='Total qty left on location',
        digits=dp.get_precision('Product Unit of Measure'),
    )

    @api.multi
    def retrieve_data(self, start, stop):
        cur_date_start = fields.Datetime.from_string(
            '%s 00:00:00' % start)
        cur_date_end = fields.Datetime.from_string(
            '%s 23:59:59' % stop)

        for line in self:
            sessions = self.env['pos.session'].search([
                ('start_at', '>=', str(cur_date_start)), '|',
                ('stop_at', '=', False),
                ('stop_at', '<=', str(cur_date_end)),
                ('config_id.shop_address_id', '=', line.shop_address_id.id),
            ])

            # order_ids only in state 'paid','done',invoiced
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['paid', 'done', 'invoiced'])
            lines = order_ids.mapped('lines').filtered(
                lambda r: r.product_id.type == 'product')
            line.update(
                {'order_line_ids': [(6, 0, lines.ids)],
                 'total_sold': sum(lines.mapped('qty')),
                 })
            if line.wizard_id.check_module_install('pos_addons'):
                line.update({
                    'total_qty_left_on_location':
                        sum(lines.mapped('qty_left_on_location'))
                })


class WizardPrintShopReport(models.TransientModel):
    _name = 'wizard.print.shop.sale.report'
    date_from = fields.Date(
        string='Date from',
        default=fields.Date.today(),
        required=True,
    )
    date_to = fields.Date(
        string='Date to',
        default=fields.Date.today(),
        required=True,
    )
    with_prices = fields.Boolean(
        string='With prices',
    )
    shop_address_ids = fields.Many2many(
        comodel_name='res.partner',
        relation='shop_adresss_res_partner_wiz_print_shop_sale_report_rel',
        string='Shop',
        context={'order': 'cash_register_sequence'},
    )
    allowed_shop_address_ids = fields.Many2many(
        comodel_name='res.partner',
        relation='allowed_shop_res_partner_wiz_print_shop_sale_report_rel',
        string='Allowed shop address_ids',
        default=lambda self: self.env['pos.config'].search([]).mapped(
            'shop_address_id')
    )
    line_ids = fields.One2many(
        comodel_name='wizard.print.shop.sale.report.location',
        inverse_name='wizard_id',
        string='Lines',
    )
    main_stock_location = fields.Many2one(
        comodel_name='stock.location',
        string='Main stock location',
    )

    @api.multi
    def print_report(self):
        """
        To get the date and print the report
        @return : return report
        """
        self.retrieve_data(),
        return self.env.ref(
            'pos_reports.action_report_shop_sale').report_action(self)

    @api.model
    def check_module_install(self, name):
        domain = [('state', '=', 'installed'), ('name', '=', name)]
        modules = self.env['ir.module.module'].search(domain)
        if not modules:
            return False
        return True

    @api.multi
    def retrieve_data(self):
        if len(self.shop_address_ids) == 0:
            raise exceptions.UserError(
                _('You need to select at least 1 shop.'))
        # remove all data
        self.line_ids.unlink()
        self.write(
            {'line_ids': [(0, 0, {'shop_address_id': shop_address_id})
                          for shop_address_id in
                          self.shop_address_ids.ids
                          ]})
        self.line_ids.retrieve_data(start=self.date_from, stop=self.date_to)

    @api.model
    def mail_report(self, mail_template='No template', days_from=-1,
                    days_to=-1, stores=False, with_prices=False):
        """
        Mail the report using an existing mail template

        How to use:
            1. Create a mail template
            2. Create a planned action
                object: wizard.print.shop.sale.report
                method: mail_report
                arguments:
                  1. Only the mail template (minimum required):
                  ("Dagelijks rapport",)
                  2. Mail template and day from - to:
                  ("Dagelijks rapport",-5,-1,)
                  of
                  ("Dagelijks rapport",5,1,)
                  3. Mail template and one store:
                  ("Dagelijks rapport",5,1,"Blue Knokke",)
                  4. Mail template, multiple stores and prices:
                  ("Dagelijks rapport",5,1,"Blue Knokke+Blue Antwerpen",True,)

        :param mail_template: The template name to use
        :param days_from: Number of days in the past to start
        :param days_to: Number of days in the past to stop
        :param stores: String with list of stores (comma separated names)
        :param with_prices: Boolean indicating if prices have to be printed
        :return: nothing
        """

        if not isinstance(days_from, int):
            _logger.exception(
                'days_from should be an integer: %s' % days_from
            )
            return

        days_start = days_from
        if days_start > 0:
            _logger.info(
                'inverting start, should be looking in the past'
            )
            days_start = -1 * days_start

        if not isinstance(days_to, int):
            _logger.exception(
                'days_to should be an integer: %s' % days_from
            )
            return

        days_end = days_to
        if days_end > 0:
            _logger.info(
                'inverting end, should be looking in the past'
            )
            days_end = -1 * days_end

        if days_start > days_end:
            _logger.info(
                'start was bigger than end, switching'
            )
            tmp = days_start
            days_start = days_end
            days_end = tmp

        dfrom = datetime.now() + timedelta(days=days_start)
        dto = datetime.now() + timedelta(days=days_end)

        rec = self.env['wizard.print.shop.sale.report'].create({
            'date_from': fields.Date().context_today(self, timestamp=dfrom),
            'date_to': fields.Date().context_today(self, timestamp=dto),
            'with_prices': with_prices,
        })

        if stores:
            store_names = stores.split('+')
            addresses = self.env['res.partner']
            for address in rec.allowed_shop_address_ids:
                if address.name in store_names:
                    addresses += address
            rec.shop_address_ids = addresses

        rec.retrieve_data()

        # Search template by name
        template = self.env['mail.template'].search(
            [('name', '=', mail_template)],
            limit=1
        )

        if not template:
            _logger.exception(
                'Mail template not found: %s' % mail_template
            )
            return

        template.send_mail(rec.id)
