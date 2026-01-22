import {Outlet} from 'react-router-dom';

export default function AdminLayout(){
    return(
        <div className='admin-page'>
            <section className='admin-content'>
                <Outlet/>
            </section>
        </div>
    )
}