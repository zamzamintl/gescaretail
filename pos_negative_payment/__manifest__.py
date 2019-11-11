# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Negative Payment',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow negative value on payment screen',
    'description': """

Allow negative value on payment screen

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': ['views/templates.xml'],
    'qweb': ['static/src/xml/pos_negative_payment.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
