# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS CCV',
    'version': '12.0.0.1.0',
    'category': 'Point of Sale',
    'summary': 'POS CCV module',
    'description': """
        POS CCV

        The POS CCV module depends on the ccv twostep server
    """,
    'author': 'Accomodata',
    'website': 'www.accomodata.be',
    'depends': [
        'base',
        'point_of_sale'
    ],
    'data': [
        'views/assets.xml',
        'views/journal.xml',
        'views/pos_config_view.xml',
    ],
    'qweb': [
        'static/xml/pos_ccv.xml'
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'images': [],
}
