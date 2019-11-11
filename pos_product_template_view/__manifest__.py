# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Product Template View',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Product Template View',
    'description': """
        Pos Product Template View
    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': [
        'point_of_sale',
    ],
    'data': [
        'report/pos_product_template_view.xml',
        'report/report.xml',
        'view/templates.xml',
    ],
    'qweb': ['static/src/xml/*.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
