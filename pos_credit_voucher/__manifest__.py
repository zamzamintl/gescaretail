# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Credit Voucher',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to generate credit voucher',
    'description': """

Allow to generate credit voucher

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'data/pos_credit_voucher.xml',
        'views/pos_credit_voucher_view.xml',
        'views/templates.xml'
    ],
    'qweb': ['static/src/xml/pos_credit_voucher.xml'],
    'auto_install': False,
    'installable': True,
    'application': False,
}
