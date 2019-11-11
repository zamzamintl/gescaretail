# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Addons',
    'version': '12.0.0.1.2',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'POS Addons',
    'description': """

POS Addons

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'data': [
        'security/ir.model.access.csv',
        'view/pos_addons_view.xml',
        'wizard/wizard_print_pos_overview_view.xml',
        'wizard/account_bank_statement.xml',
        'reports/pos_order_overview_templates.xml',
        'reports/pos_order_reports.xml',
        'view/templates.xml'
    ],
    'depends': ['point_of_sale_receipt'],
    'qweb': ['static/src/xml/pos_addons.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
