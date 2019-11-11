# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Gift Card',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to generate gift card and redeem',
    'description': """

Allow to generate gift card and redeem gift card

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
            'data/product_demo_data.xml',
            'security/ir.model.access.csv',
            'views/templates.xml',
            'views/pos_gift_card_view.xml'],
    'qweb': ['static/src/xml/*.xml'],
    'auto_install': False,
    'installable': True,
    'application': False,
}
