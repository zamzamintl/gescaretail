# -*- coding: utf-8 -*-

from odoo import fields, models, api


class PrintPosOverviewLine(models.TransientModel):
    _name = 'print.pos.overview.line'
    _order = 'group_code'
    wizard_id = fields.Many2one(
        comodel_name='print.pos.config.overview',
        string='Wizard',
    )
    journal_ids = fields.Many2many(
        comodel_name='account.journal',
        string='Journals',
    )
    group_code = fields.Char(
        string='Group code',
    )
    statement_ids = fields.Many2many(
        comodel_name='account.bank.statement.line',
        string='Statements',
    )
    amount = fields.Float(
        string='Amount',
        compute='_compute_amount',
    )
    turnover = fields.Boolean(
        string='Turnover',
    )

    @api.multi
    def _compute_amount(self):
        for line in self:
            line.amount = sum(
                line.statement_ids.mapped('amount'))

    @api.depends('session_ids')
    def _compute_nbr_pieces_sellings(self):
        for line in self:
            # order ids only in state 'paid,done,invoiced'
            order_ids = line.session_ids.mappde('order_ids').filtered(
                lambda r: r.state in ['paid', 'done', 'invoiced'])
            lines = order_ids.mapped('lines')
            line.nbr_pieces = sum(lines.mapped('qty'))
            line.nbr_sold = len(lines)


class PrintPosConfigOverview(models.TransientModel):
    _name = "print.pos.config.overview"
    _description = 'Pos Overview per config'
    _order = 'cash_register_sequence ASC'
    wizard_id = fields.Many2one(
        comodel_name='print.pos.overview',
        string='Wizard',
    )
    remark = fields.Text(
        string='Remark',
        compute='_compute_totals'
    )
    users = fields.Text(
        string='Users',
        compute='_compute_totals'
    )
    shop_address_id = fields.Many2one(
        comodel_name='res.partner',
        string='Shop'
    )
    cash_register_sequence = fields.Integer(
        related='shop_address_id.cash_register_sequence',
        string='Cash register Sequence',
        store=True,
    )
    total_income = fields.Float(
        string='Total income',
        compute='_compute_totals',
    )
    netto_turnover = fields.Float(
        string='Netto turnover',
        compute='_compute_totals',
    )
    amount_discount = fields.Float(
        string='Amount discount',
        compute='_compute_totals',
    )
    amount_invoiced = fields.Float(
        string='Amount invoiced',
        compute='_compute_totals',
    )
    amount_total_cash = fields.Float(
        string='Amount total Cash',
        compute='_compute_totals',
    )
    amount_opening_balance_theoretical = fields.Float(
        string='Amount opening balance theoretical',
        compute='_compute_totals',
    )
    amount_opening_balance = fields.Float(
        string='Amount opening balance',
        compute='_compute_totals',
    )
    amount_opening_balance_diff = fields.Float(
        string='Amount opening balance diff',
        comput='_compute_totals',
    )
    amount_transfered = fields.Float(
        string='Amount Transfered',
        compute='_compute_totals',
    )
    amount_closing_balance = fields.Float(
        string='Amount closing balance',
        compute='_compute_totals'
    )
    amount_closing_difference = fields.Float(
        string='Amount closing difference',
        compute='_compute_totals',
    )
    amount_bank_transfer = fields.Float(
        string='Amount bank transfer',
        compute='_compute_totals',
    )
    amount_total = fields.Float(
        string='Amount Total',
    )
    qty_sold = fields.Integer(
        string='Qty Sold',
        compute='_compute_totals',
    )
    total_pieces = fields.Integer(
        string='Total Pieces',
        compute='_compute_totals',
    )
    overview_line_ids_with_turnover = fields.One2many(
        comodel_name='print.pos.overview.line',
        inverse_name='wizard_id',
        string='Overview details with turnover',
        domain=[('turnover', '=', True)]
    )
    overview_line_ids_with_no_turnover = fields.One2many(
        comodel_name='print.pos.overview.line',
        inverse_name='wizard_id',
        string='Overview details with no turnover',
        domain=[('turnover', '=', False)]
    )
    session_ids = fields.Many2many(
        comodel_name='pos.session',
        string='Sessions'
    )
    cash_out_ids = fields.Many2many(
        comodel_name='account.bank.statement.line',
        string='Cash out references',
        compute='_compute_totals',
    )
    cash_in_ids = fields.Many2many(
        comodel_name='account.bank.statement.line',
        string='Cash in references',
        compute='_compute_totals',
    )

    @api.multi
    def _compute_totals(self):
        # Calculate amount discount
        def get_amount_discount(sessions):
            # order_ids only in state 'done','paid','invoiced'
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['done', 'paid', 'invoiced'])
            return sum(order_ids.mapped('lines.discount_amount'))

        # Calculate amount turnover
        def get_amount_turnover(sessions):
            # order_ids only in state 'done','paid','invoiced'
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['done', 'paid', 'invoiced'])
            stat_ids = order_ids.mapped('statement_ids')
            return sum(stat_ids.filtered(
                lambda r: r.journal_id.group_code.turnover).mapped('amount'))

        # Calculate amount invoiced
        def get_amount_invoiced(sessions):
            # order_ids only in state 'done','paid','invoiced'
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['done', 'paid', 'invoiced'])
            return sum(order_ids.mapped('invoice_id.amount_total'))

        def get_qty_sold(sessions):
            # get all products which should not be allowed
            prods_not_allowed = self.env['product.product']
            try:
                for conf in sessions.mapped('config_id'):
                    prods_not_allowed += conf.cancellation_charges_product_id
                    prods_not_allowed += conf.refund_amount_product_id
                    prods_not_allowed += conf.prod_for_payment
            except AttributeError:
                prods_not_allowed = self.env['product.product']

            # order_ids only in state 'done','paid','invoiced'
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['done', 'paid', 'invoiced'])
            return len(
                order_ids.mapped('lines').filtered(
                    lambda r:
                    r.product_id.type == 'product' and
                    r.product_id not in prods_not_allowed).mapped(
                    'order_id'))

        def get_qty_pieces(sessions):
            # Get total pieces sold from all products which are of type
            # product
            # order_ids only in state 'done','paid','invoiced'
            order_ids = sessions.mapped('order_ids').filtered(
                lambda r: r.state in ['done', 'paid', 'invoiced'])
            return sum(order_ids.mapped('lines').filtered(
                lambda r: r.product_id.type == 'product').mapped('qty'))

        def get_remarks(sessions):
            return '|'.join(
                [session.remark for session in sessions if session.remark])

        def get_users(sessions):
            return '|'.join(
                [session.cash_register_id.cashbox_end_id.closing_user.name for
                 session in sessions if
                 session.cash_register_id.cashbox_end_id and
                 session.cash_register_id.cashbox_end_id.closing_user])

        for shop in self:
            # get session remark
            shop.remark = get_remarks(shop.session_ids)
            shop.users = get_users(shop.session_ids)
            # total income is based on statements
            shop.total_income = sum(
                shop.overview_line_ids_with_turnover.mapped('amount'))

            # netto_turnover is based on pos orders
            shop.netto_turnover = get_amount_turnover(shop.session_ids)

            # amount discount & invoiced
            shop.amount_discount = get_amount_discount(shop.session_ids)
            shop.amount_invoiced = get_amount_invoiced(shop.session_ids)

            # qty sold
            shop.qty_sold = get_qty_sold(shop.session_ids)
            shop.total_pieces = get_qty_pieces(shop.session_ids)
            # total amount cash
            shop.amount_total_cash = shop.amount_invoiced

            # amount counterdes & invoiced previous session
            prev_invoiced = get_amount_invoiced(
                shop.session_ids.get_previous_session())

            # previous amount opening balance
            shop.amount_opening_balance_theoretical = prev_invoiced

            # total amount opening balance
            shop.amount_opening_balance = sum(
                shop.session_ids.mapped('cash_register_balance_start'))

            # Opening balance difference
            shop.amount_opening_balance_diff = \
                shop.amount_opening_balance_theoretical - \
                shop.amount_opening_balance

            # total amount closing balance
            shop.amount_closing_balance = sum(
                shop.session_ids.mapped('cash_register_balance_end_real'))
            shop.amount_closing_difference = sum(
                shop.session_ids.mapped('cash_register_difference'))
            # cash_out_ids
            shop.cash_out_ids = shop.mapped('session_ids.cash_out_ids')
            try:
                # cash_out_ids
                shop.cash_in_ids = shop.mapped('session_ids.cash_in_line_ids')
            except KeyError:
                shop.cash_in_ids = shop.cash_in_ids

            # total tranfered
            # shop.amount_transfered = sum(
            #     shop.session_ids.mapped(
            #         'cash_register_total_entry_encoding'))
            shop.amount_transfered = sum(
                shop.cash_out_ids.filtered(lambda r: not r.bank_out).mapped(
                    'amount'))
            shop.amount_bank_transfer = sum(
                shop.cash_out_ids.filtered(lambda r: r.bank_out).mapped(
                    'amount'))

            # total amount
            shop.amount_total = \
                shop.amount_total_cash + \
                shop.amount_opening_balance + \
                shop.amount_closing_balance + \
                shop.amount_closing_difference + \
                shop.amount_transfered


class PrintPosOverview(models.TransientModel):
    _name = 'print.pos.overview'
    _description = "Pos Overview"

    date_from = fields.Date(
        string='Date',
        default=fields.Date.context_today,
    )
    detail_info = fields.Boolean(
        string='Detail Info',
    )
    shop_address_ids = fields.Many2many(
        comodel_name='res.partner',
        string='Shop',
        context={'order': 'cash_register_sequence'},
    )
    allowed_shop_address_ids = fields.Many2many(
        comodel_name='res.partner',
        string='Allowed shop address_ids',
        default=lambda self: self.env['pos.config'].search([]).mapped(
            'shop_address_id')
    )
    overview_config_ids = fields.One2many(
        comodel_name='print.pos.config.overview',
        inverse_name='wizard_id',
        string='Overview details',
    )

    @api.model
    def get_sessions_by_date(self, date_from, date_to, shop_address_ids):
        crit = [
            ('start_at', '>=', fields.Datetime.to_string(date_from)),
            ('start_at', '<=', fields.Datetime.to_string(date_to)),
            ('config_id.shop_address_id', 'in', shop_address_ids)
        ]
        return self.env['pos.session'].search(crit)

    @api.model
    def get_sessions(self):
        if self.date_from:
            # Get all the sessions for that date
            date_start = fields.Datetime.from_string(
                '%s 00:00:00' % self.date_from)
            date_end = fields.Datetime.from_string(
                '%s 23:59:59' % self.date_from)
            return self.get_sessions_by_date(
                date_from=date_start,
                date_to=date_end,
                shop_address_ids=self.shop_address_ids.ids
            )
        return False

    @api.multi
    def get_overview_line_ids(self, sessions, turnover=False):
        self.ensure_one()
        res = []
        for session in sessions:
            # order_ids only in state 'paid','done','invoiced
            order_ids = session.mapped('order_ids').filtered(
                lambda r: r.state in ['paid', 'done', 'invoiced'])
            # Get the group codes
            group_codes = order_ids.mapped(
                'statement_ids.journal_id.group_code')
            for code in group_codes:
                statement_ids = order_ids.mapped('statement_ids').filtered(
                    lambda r:
                    r.journal_id.group_code == code and
                    r.journal_id.group_code.turnover == turnover)
                journal_ids = statement_ids.mapped('journal_id')
                if not journal_ids:
                    continue
                res.append((0, 0, {
                    'journal_ids': [(6, 0, journal_ids.ids)],
                    'group_code': code.name,
                    'statement_ids': [(6, 0, statement_ids.ids)],
                    'turnover': turnover,
                }))
        return res

    @api.multi
    def retrieve_data(self):
        # remove all data
        self.overview_config_ids.unlink()
        # Get the sessions
        sessions = self.get_sessions()
        if sessions:
            # Get all shops ids from the sessions selected by the dates
            shop_address_ids = list(
                set(sessions.mapped('config_id.shop_address_id')))
            # build shop address lines
            config_lines = []
            for shop_address_id in shop_address_ids:
                session_list = sessions.filtered(
                    lambda r: r.config_id.shop_address_id == shop_address_id)
                overview_line_ids_wt = self.get_overview_line_ids(
                    sessions=session_list, turnover=True)
                overview_line_ids_no_wt = self.get_overview_line_ids(
                    sessions=session_list, turnover=False)
                config_line = {
                    'shop_address_id': shop_address_id.id,
                    'session_ids': [(6, 0, session_list.ids)],
                    'overview_line_ids_with_turnover': overview_line_ids_wt,
                    'overview_line_ids_with_no_turnover':
                    overview_line_ids_no_wt,
                }
                config_lines.append((0, 0, config_line))
            self.write({'overview_config_ids': config_lines})
        return True

    @api.multi
    def open_wizard(self):
        partner_ids = self.env['pos.config'].search([]).mapped(
            'shop_address_id')
        new_id = self.create({'shop_address_ids': partner_ids})
        action = self.env.ref(
            'pos_addons.action_print_point_of_sale_overview').read()[0]
        action.update({'res_id': new_id.id})
        return action

    @api.multi
    def print_report(self):
        self.retrieve_data()
        """
        To get the date and print the report
        @return : return report
        """
        data = {'date_from': self.date_from,
                'shop_address_ids': self.shop_address_ids.ids, 'id': self.id}
        return self.env.ref(
            'pos_addons.action_report_pos_order_overview').report_action(
            [], data=data)
