# See LICENSE file for full copyright and licensing details.

{
    'name': 'Point Of Sale Receipt',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Custom receipt format',
    'description': """

Custom receipt format

""",
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['point_of_sale'],
    'data': [
        'view/point_of_sale_receipt_view.xml',
        'view/templates.xml'
    ],
    'qweb': ['static/src/xml/point_of_sale_receipt.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
