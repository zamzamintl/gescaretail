# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Discount Management',
    'version': '12.0.0.1.0',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to manage discount',
    'description': """

Allow to manage discount

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'views/pos_discount_management_view.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_discount_management.xml'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
