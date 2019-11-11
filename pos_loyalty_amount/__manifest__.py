# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Loyalty Amount',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Loyalty Amount',
    'description': """

Pos Loyalty Amount

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_loyalty_amount_view.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_loyalty_amount.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
