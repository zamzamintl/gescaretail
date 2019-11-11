# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Order History',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allows to see pos order history on pos screen',
    'description': """

 This Module allows you to see pos order history on pos screen.

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['web', 'point_of_sale'],
    'data': [
        'view/templates.xml',
        'view/pos_config_views.xml',
    ],
    'qweb': ['static/src/xml/pos_order_history.xml'],
    'installable': True,
    'auto_install': False,
    'application': True,
}
